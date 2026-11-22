import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { GOOGLE, GATEWAY, type GoogleConnector } from "./google-config";
export { GOOGLE, type GoogleConnector } from "./google-config";
const Connector = z.enum(["google_mail", "google_calendar", "google_drive"]);
const Ws = z.string().uuid().nullable();

type Ctx = { userId: string; supabase: import("@supabase/supabase-js").SupabaseClient };
const ctxOf = (c: unknown) => c as Ctx;

export const getGoogleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = ctxOf(context);
    const { listConnectionsForUser } = await import("@/server/appUserConnections.server");
    const rows = await listConnectionsForUser(userId);
    const out: Record<
      string,
      {
        connected: boolean;
        reconnectRequired: boolean;
        account: string | null;
        lastSyncAt: string | null;
        lastSyncCount: number;
        lastError: string | null;
        since: string | null;
      }
    > = {};
    const accounts: Record<string, string | null> = {};
    await Promise.all(
      rows
        .filter((r) => r.connector_id in GOOGLE && !r.reconnect_required)
        .map(async (r) => {
          accounts[r.connector_id] = await (
            await import("./google-scan.server")
          ).accountEmail(userId, r.connector_id as GoogleConnector);
        }),
    );
    const latest = await listConnectionsForUser(userId); // an account lookup may have flagged a reconnect
    for (const c of Object.keys(GOOGLE) as GoogleConnector[]) {
      const cur = latest.find((x) => x.connector_id === c);
      out[c] = {
        connected: !!cur,
        reconnectRequired: !!cur?.reconnect_required,
        account: cur?.reconnect_required ? null : (accounts[c] ?? null),
        lastSyncAt: cur?.last_sync_at ?? null,
        lastSyncCount: cur?.last_sync_count ?? 0,
        lastError: cur?.last_error ?? null,
        since: cur?.created_at ?? null,
      };
    }
    return out;
  });

export const startGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ connector: Connector, origin: z.string().url().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = ctxOf(context);
    const { requireFeature } = await import("./feature-access.server");
    await requireFeature(userId, "google_integrations");
    const { requireConnectorPlan } = await import("./connector-review.server");
    await requireConnectorPlan(userId, data.connector);
    const clientKey = process.env[GOOGLE[data.connector].env];
    if (!clientKey) throw new Error("Google connection isn't set up for this app yet.");
    const { beginConsent } = await import("./google-consent.server");
    const { state, returnUrl } = await beginConsent(userId, data.connector, data.origin);
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const existing = await getConnectionKeyForUser(userId, data.connector);
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY,
      connectorId: data.connector,
      appUserId: userId,
      clientAPIKey: clientKey,
      returnUrl,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: { scopes: [...GOOGLE[data.connector].scopes] },
    });
    return { authorizationUrl, state };
  });

export const completeGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        connector: Connector,
        state: z.string().min(32).max(100),
        code: z.string().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = ctxOf(context);
    await (
      await import("./google-consent.server")
    ).consumeConsent(userId, data.connector, data.state);
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY, data.code);
    if (connectorId !== data.connector)
      throw new Error("Google returned a different service than expected.");
    await saveConnectionKeyForUser(userId, connectorId, connectionAPIKey);
    return { ok: true };
  });

export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ connector: Connector }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = ctxOf(context);
    const { getConnectionKeyForUser, deleteConnectionForUser } =
      await import("@/server/appUserConnections.server");
    const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
    const key = await getConnectionKeyForUser(userId, data.connector);
    if (key) {
      try {
        await disconnectAppUser({
          gatewayBaseUrl: GATEWAY,
          connectionAPIKey: key,
          connectorId: data.connector,
        });
      } catch (e) {
        console.error("Google disconnect", e);
      }
    }
    await deleteConnectionForUser(userId, data.connector);
    return { ok: true };
  });

/* ---------------- shared helpers ---------------- */
const fail = async (userId: string, c: GoogleConnector, e: unknown) => {
  const msg = e instanceof Error ? e.message : "Sync failed";
  if (msg === "RECONNECT")
    return {
      error: "Your Google access needs to be renewed. Press Reconnect.",
      reconnectRequired: true,
    };
  if (msg === "NOT_CONNECTED") return { error: "Connect Google first." };
  const { markConnection } = await import("@/server/appUserConnections.server");
  await markConnection(userId, c, { last_error: msg.slice(0, 300) });
  return { error: msg };
};

/* ---------------- Gmail ---------------- */
export const syncGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: Ws }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = ctxOf(context);
    const c = "google_mail" as const;
    try {
      await checkScope(supabase, data.workspaceId);
      return await (await import("./google-scan.server")).scanGmail(userId, data.workspaceId);
    } catch (e) {
      return fail(userId, c, e);
    }
  });

/* ---------------- Calendar ---------------- */
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const plusDay = (d: string) => {
  const [y = 0, m = 1, dd = 1] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, dd + 1));
  return t.toISOString().slice(0, 10);
};

export const syncCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: Ws }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = ctxOf(context);
    const c = "google_calendar" as const;
    try {
      const { getLinks, saveLink, markConnection } =
        await import("@/server/appUserConnections.server");
      let query = supabase
        .from("home_items")
        .select("id,section,title,subtitle,fields")
        .in("section", ["warranties", "renewals", "maintenance"])
        .limit(300);
      query = data.workspaceId
        ? query.eq("workspace_id", data.workspaceId)
        : query.is("workspace_id", null);
      const { data: rows, error } = await query;
      if (error) throw new Error("Couldn't read your reminders.");
      const due = (rows ?? []).flatMap((r) => {
        const f = (r.fields as [string, string][]) ?? [];
        const key =
          r.section === "warranties"
            ? /^expiry date$/i
            : r.section === "renewals"
              ? /^renewal date$/i
              : /(due|next).*(date)?|date due/i;
        const hit = f.find(([k, v]) => key.test(k) && ISO.test(v));
        const archived = f.some(([k, v]) => k === "Status" && /archived/i.test(v));
        return hit && !archived ? [{ ...r, date: hit[1] }] : [];
      });
      const links = await getLinks(
        userId,
        c,
        due.map((d) => d.id),
      );
      let created = 0,
        updated = 0;
      const label = {
        warranties: "Warranty ends",
        renewals: "Renewal due",
        maintenance: "Maintenance due",
      } as Record<string, string>;
      for (const d of due) {
        const ev = {
          summary: `${label[d.section]}: ${d.title}`.slice(0, 250),
          description: `${d.subtitle}\n\nAdded by MatrixKeep. Open the record in MatrixKeep to see details and evidence.`,
          start: { date: d.date },
          end: { date: plusDay(d.date) },
          reminders: {
            useDefault: false,
            overrides: [
              { method: "popup", minutes: 40320 },
              { method: "popup", minutes: 10080 },
              { method: "email", minutes: 10080 },
            ],
          },
          extendedProperties: { private: { matrixkeepItem: d.id } },
        };
        const existing = links.get(d.id)?.google_id;
        let eventId: string | null = null;
        if (existing) {
          try {
            const r = await (
              await import("./google-scan.server")
            ).google(
              userId,
              c,
              `/calendar/v3/calendars/primary/events/${encodeURIComponent(existing)}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ev),
              },
            );
            eventId = ((await r.json()) as { id: string }).id;
            updated++;
          } catch (e) {
            if (e instanceof Error && e.message === "RECONNECT") throw e;
          }
        }
        if (!eventId) {
          const r = await (
            await import("./google-scan.server")
          ).google(userId, c, "/calendar/v3/calendars/primary/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ev),
          });
          eventId = ((await r.json()) as { id: string }).id;
          created++;
        }
        await saveLink(userId, c, d.id, d.id, eventId);
      }
      await markConnection(userId, c, {
        last_sync_at: new Date().toISOString(),
        last_sync_count: created + updated,
        last_error: null,
      });
      return { created, updated, skippedNoDate: (rows ?? []).length - due.length };
    } catch (e) {
      return fail(userId, c, e);
    }
  });

/* ---------------- Drive ---------------- */
export const listDriveFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ search: z.string().max(100).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = ctxOf(context);
    try {
      const s = data.search.replace(/['\\]/g, "");
      const q = `trashed=false and (mimeType='application/pdf' or mimeType contains 'image/')${s ? ` and name contains '${s}'` : ""}`;
      const r = await (
        await import("./google-scan.server")
      ).google(
        userId,
        "google_drive",
        `/drive/v3/files?pageSize=30&orderBy=modifiedTime desc&fields=files(id,name,mimeType,size,modifiedTime)&q=${encodeURIComponent(q)}`,
      );
      const j = (await r.json()) as {
        files?: {
          id: string;
          name: string;
          mimeType: string;
          size?: string;
          modifiedTime: string;
        }[];
      };
      return {
        files: (j.files ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          size: Number(f.size ?? 0),
          modifiedTime: f.modifiedTime,
        })),
      };
    } catch (e) {
      return fail(userId, "google_drive", e);
    }
  });

export const importDriveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ fileId: z.string().regex(/^[\w-]{5,200}$/), workspaceId: Ws }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = ctxOf(context);
    const c = "google_drive" as const;
    try {
      await checkScope(supabase, data.workspaceId);
      return await (
        await import("./google-scan.server")
      ).importDrive(userId, data.workspaceId, data.fileId);
    } catch (e) {
      return fail(userId, c, e);
    }
  });

async function checkScope(client: Ctx["supabase"], ws: string | null) {
  const access = await client.rpc("can_access_workspace", { _workspace: ws });
  if (access.error || !access.data) throw Error("Workspace unavailable");
}
const reviewScope = z.object({
  workspaceId: Ws,
  connector: z.enum(["google_mail", "google_drive", "outlook", "onedrive"]),
});
export const pendingReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reviewScope.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = ctxOf(context);
    let q = supabase
      .from("connector_reviews")
      .select("id,title,proposals,state")
      .eq("provider", data.connector)
      .in("state", ["pending", "pending_evidence"]);
    q = data.workspaceId ? q.eq("workspace_id", data.workspaceId) : q.is("workspace_id", null);
    const r = await q.order("created_at", { ascending: true }).limit(40);
    if (r.error) throw Error("Review queue unavailable");
    return r.data as {
      id: string;
      title: string;
      state: string;
      proposals: import("./capture.server").Extracted[];
    }[];
  });
const edited = z.object({
  section: z.string().max(40),
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().max(500),
  relates_to: z.string().max(200),
  fields: z.array(z.object({ label: z.string().max(120), value: z.string().max(4000) })).max(64),
});
export const decideReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    reviewScope
      .extend({
        id: z.string().uuid(),
        property: Ws,
        room: z.string().max(200),
        records: z.array(edited).max(16),
        reject: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = ctxOf(context);
    await checkScope(supabase, data.workspaceId);
    const { db, scoped, fingerprint } = await import("./connector-review.server");
    const scope = { user: userId, ws: data.workspaceId, provider: data.connector };
    const { data: draft, error } = await scoped("connector_reviews", scope)
      .eq("id", data.id)
      .single();
    if (error || !draft) throw Error("Review unavailable");
    if (draft.state === "approved")
      return draft.saved as { id: string; section: string; title: string }[];
    if (!["pending", "pending_evidence"].includes(draft.state))
      throw Error("Review already closed");
    if (!data.reject) {
      const { requireConnectorPlan } = await import("./connector-review.server");
      await requireConnectorPlan(userId, data.connector);
    }
    if (data.reject) {
      const r = await db
        .from("connector_reviews")
        .update({ state: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", data.id)
        .eq("state", "pending")
        .select("id")
        .single();
      if (r.error) throw Error("Review changed");
      return [];
    }
    let bytes: Buffer | undefined;
    if (draft.attachment) {
      bytes =
        data.connector === "outlook" || data.connector === "onedrive"
          ? await (
              await import("./ms-connector.server")
            ).msBytes(userId, data.connector, draft.attachment)
          : await (
              await import("./google-scan.server")
            ).googleAttachment(userId, data.connector, draft.attachment);
      if (fingerprint(bytes) !== draft.attachment.hash)
        throw Error("The attachment changed. Review the updated version.");
    }
    const saved = await db.rpc("confirm_connector_review", {
      _id: data.id,
      _user: userId,
      _workspace: data.workspaceId,
      _property: data.property,
      _room: data.room,
      _records: data.records,
      _path: null,
    });
    if (saved.error)
      throw Error("Could not save this review. Check the property and room, then retry.");
    const rows = saved.data as { id: string; title: string; section: string }[];
    if (bytes) {
      const f = draft.attachment;
      const item = rows.find((r) => r.section === "documents") ?? rows[0];
      if (!item) throw Error("Approved record unavailable");
      const path = userId + "/" + item.id + "/" + f.hash;
      const upload = await supabase.storage
        .from("evidence")
        .upload(path, bytes, { contentType: f.mime, upsert: true });
      if (upload.error) throw Error("Records saved. Retry attaching the evidence.");
      const complete = await db.rpc("complete_connector_evidence", {
        _id: data.id,
        _user: userId,
        _workspace: data.workspaceId,
        _path: path,
      });
      if (complete.error) throw Error("Records saved. Retry attaching the evidence.");
    }
    return rows;
  });

export const rereadConnectorItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reviewScope.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = ctxOf(context);
    await checkScope(supabase, data.workspaceId);
    const { scoped, db, requireConnectorPlan, fingerprint } =
      await import("./connector-review.server");
    await requireConnectorPlan(userId, data.connector);
    const scope = { user: userId, ws: data.workspaceId, provider: data.connector };
    const got = await scoped("connector_reviews", scope)
      .eq("id", data.id)
      .eq("state", "pending")
      .single();
    if (!got.data) throw Error("This item is no longer awaiting review.");
    const draft = got.data,
      stamp = new Date().toISOString(),
      lock = await db
        .from("connector_reviews")
        .update({ reprocessed_at: stamp })
        .eq("id", data.id)
        .eq("state", "pending")
        .or(
          "reprocessed_at.is.null,reprocessed_at.lt." + new Date(Date.now() - 120000).toISOString(),
        )
        .select("id")
        .maybeSingle();
    if (!lock.data) throw Error("A re-read was recently requested.");
    const gs = await import("./google-scan.server"),
      ms = await import("./ms-connector.server");
    const source = new Map<string, string>(draft.source || []);
    let image: string | undefined,
      text = "";
    if (draft.attachment) {
      const f = draft.attachment;
      const bytes =
        data.connector === "google_mail" || data.connector === "google_drive"
          ? await gs.googleAttachment(userId, data.connector, f)
          : await ms.msBytes(userId, data.connector, f);
      if (f.hash !== fingerprint(bytes))
        throw Error("The file has changed. Import its current version.");
      image = "data:" + f.mime + ";base64," + bytes.toString("base64");
    } else {
      const id = source.get("Message ID");
      if (!id) throw Error("Source message unavailable.");
      const body =
        data.connector === "google_mail"
          ? await gs.googleBody(userId, id)
          : await ms.outlookBody(userId, id);
      text = (draft.title + "\n" + body).slice(0, 9000);
    }
    const { connectorAttribution } = await import("./ai-meter.server"),
      { runExtraction } = await import("./capture.server");
    const result = await connectorAttribution.run(data.connector, () =>
      runExtraction(
        {
          workspaceId: data.workspaceId,
          mode: image ? "Upload document" : "Import email",
          text,
          ...(image ? { image } : {}),
        },
        userId,
        stamp,
      ),
    );
    if ("error" in result || !result.records.length)
      throw Error("Could not identify records in this source.");
    const updated = await db
      .from("connector_reviews")
      .update({ proposals: result.records })
      .eq("id", data.id)
      .eq("reprocessed_at", stamp)
      .eq("state", "pending")
      .select("id")
      .single();
    if (updated.error) throw Error("Review changed while reading.");
  });
