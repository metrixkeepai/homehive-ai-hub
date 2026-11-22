import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev";
const BASE = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];
export const GOOGLE = {
  google_mail: {
    scopes: [...BASE, "https://www.googleapis.com/auth/gmail.readonly"],
    env: "GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY",
  },
  google_calendar: {
    scopes: [...BASE, "https://www.googleapis.com/auth/calendar.events"],
    env: "GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY",
  },
  google_drive: {
    scopes: [...BASE, "https://www.googleapis.com/auth/drive.readonly"],
    env: "GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY",
  },
} as const;
export type GoogleConnector = keyof typeof GOOGLE;
const Connector = z.enum(["google_mail", "google_calendar", "google_drive"]);
const Ws = z.string().uuid().nullable();

type Ctx = { userId: string; supabase: import("@supabase/supabase-js").SupabaseClient };
const ctxOf = (c: unknown) => c as Ctx;

/** Call Google as the signed-in user; marks the connection for reconnect when the grant is no longer valid. */
async function google(
  userId: string,
  connector: GoogleConnector,
  path: string,
  init?: RequestInit,
) {
  const { requireConnectorPlan } = await import("./connector-review.server");
  await requireConnectorPlan(userId, connector);
  const { requireFeature } = await import("./feature-access.server");
  await requireFeature(userId, "google_integrations");
  const { getConnectionKeyForUser, markConnection } =
    await import("@/server/appUserConnections.server");
  const { callAsAppUser, appUserReconnectRequired } =
    await import("@/integrations/lovable/appUserConnector");
  const key = await getConnectionKeyForUser(userId, connector);
  if (!key) throw new Error("NOT_CONNECTED");
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY,
    connectionAPIKey: key,
    connectorId: connector,
    path,
    init,
    requiredScopes: [...GOOGLE[connector].scopes],
  });
  if (await appUserReconnectRequired(res)) {
    await markConnection(userId, connector, { reconnect_required: true });
    throw new Error("RECONNECT");
  }
  if (!res.ok) {
    await res.body?.cancel();
    console.error(
      JSON.stringify({ event: "google_request_failed", connector, status: res.status }),
    );
    throw new Error(`Google request failed (${res.status})`);
  }
  return res;
}

async function accountEmail(userId: string, c: GoogleConnector): Promise<string | null> {
  try {
    if (c === "google_mail")
      return (
        (
          (await (await google(userId, c, "/gmail/v1/users/me/profile")).json()) as {
            emailAddress?: string;
          }
        ).emailAddress ?? null
      );
    if (c === "google_calendar")
      return (
        (
          (await (await google(userId, c, "/calendar/v3/calendars/primary")).json()) as {
            id?: string;
          }
        ).id ?? null
      );
    return (
      (
        (await (await google(userId, c, "/drive/v3/about?fields=user(emailAddress)")).json()) as {
          user?: { emailAddress?: string };
        }
      ).user?.emailAddress ?? null
    );
  } catch {
    return null;
  }
}

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
          accounts[r.connector_id] = await accountEmail(userId, r.connector_id as GoogleConnector);
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
  .inputValidator((d: unknown) => z.object({ connector: Connector }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = ctxOf(context);
    const { requireFeature } = await import("./feature-access.server");
    await requireFeature(userId, "google_integrations");
    const { requireConnectorPlan } = await import("./connector-review.server");
    await requireConnectorPlan(userId, data.connector);
    const clientKey = process.env[GOOGLE[data.connector].env];
    if (!clientKey) throw new Error("Google connection isn't set up for this app yet.");
    const { googleOAuthReturnUrl } = await import("./app-origin.server");
    const returnUrl = googleOAuthReturnUrl();
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
    return { authorizationUrl };
  });

export const completeGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ connector: Connector, code: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = ctxOf(context);
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
const b64url = (s: string) =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
type Part = {
  filename?: string;
  mimeType?: string;
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: Part[];
};
const plainText = (p: Part): string => {
  if (p.mimeType === "text/plain" && p.body?.data) return b64url(p.body.data);
  for (const c of p.parts ?? []) {
    const t = plainText(c);
    if (t) return t;
  }
  if (p.mimeType === "text/html" && p.body?.data)
    return b64url(p.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ");
  for (const c of p.parts ?? [])
    if (c.mimeType === "text/html" && c.body?.data) return plainText({ ...c });
  return "";
};

export const syncGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: Ws }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = ctxOf(context);
    const c = "google_mail" as const;
    try {
      const { scoped, db, queue, eligible } = await import("./connector-review.server");
      const { getLinks, markConnection } = await import("@/server/appUserConnections.server");
      const scope = { user: userId, ws: data.workspaceId, provider: c };
      await checkScope(supabase, data.workspaceId);
      const account = await accountEmail(userId, c);
      if (!account) throw Error("Couldn't identify the connected mailbox.");
      const state = await scoped("connector_scan_state", scope)
        .eq("account", account)
        .maybeSingle();
      if (state.error) throw Error("Checkpoint unavailable");
      const lower = Number(state.data?.watermark) || Math.floor(Date.now() / 1000) - 180 * 86400;
      const upper = Number(state.data?.upper_bound) || Math.floor(Date.now() / 1000);
      const q = `after:${lower - 1} before:${upper} {receipt invoice warranty guarantee renewal policy contract subscription "order confirmation" "purchase confirmation"} -in:spam -in:trash -category:promotions -category:social`;
      const params = new URLSearchParams({ q, maxResults: "4" });
      if (state.data?.page_token) params.set("pageToken", state.data.page_token);
      const list = (await (
        await google(userId, c, "/gmail/v1/users/me/messages?" + params)
      ).json()) as { messages?: { id: string }[]; nextPageToken?: string };
      const ids = (list.messages ?? []).map((m) => m.id),
        prefix = data.workspaceId ?? "personal";
      const legacy = await getLinks(
        userId,
        c,
        ids.map((id) => prefix + ":" + id),
      );
      let created = 0,
        skipped = 0;
      for (const id of ids) {
        const key = account + ":" + id;
        if (legacy.has(prefix + ":" + id)) {
          skipped++;
          continue;
        }
        const existing = await scoped("connector_reviews", scope)
          .eq("external_key", key)
          .maybeSingle();
        if (existing.error) throw Error("Review lookup failed");
        if (existing.data) {
          skipped++;
          continue;
        }
        const meta = await (
          await google(
            userId,
            c,
            `/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date&metadataHeaders=List-Unsubscribe`,
          )
        ).json();
        const header = (name: string) =>
          String(
            meta.payload?.headers?.find(
              (h: { name: string }) => h.name.toLowerCase() === name.toLowerCase(),
            )?.value ?? "",
          ).slice(0, 250);
        const title = header("Subject");
        if (
          (header("List-Unsubscribe") && !/invoice|receipt|warranty|policy|renewal/i.test(title)) ||
          /newsletter|weekly digest/i.test(title)
        )
          continue;
        const msg = await (
          await google(userId, c, `/gmail/v1/users/me/messages/${id}?format=full`)
        ).json();
        const source = [
          ["Source", "Gmail"],
          ["Connected account", account],
          ["Sender", header("From")],
          ["Email subject", title],
          ["Received", header("Date")],
          ["Message ID", id],
        ];
        const files: import("./connector-review.server").Attachment[] = [];
        const walk = (part: Part) => {
          if (part.filename && part.body?.attachmentId) {
            const a = {
              name: part.filename,
              mime: part.mimeType ?? "",
              size: part.body.size ?? 0,
              message: id,
              attachmentId: part.body.attachmentId,
            };
            if (eligible(a)) files.push(a);
          }
          for (const child of part.parts ?? []) walk(child);
        };
        walk(msg.payload ?? {});
        if (files.length > 4)
          throw Error(
            "Message has more than four eligible attachments. Select individual files through Add anything.",
          );
        if (files.length) {
          for (const file of files) {
            const external = key + ":" + file.attachmentId;
            const seen = await scoped("connector_reviews", scope)
              .eq("external_key", external)
              .maybeSingle();
            if (seen.error) throw Error("Review lookup failed");
            if (seen.data) {
              skipped++;
              continue;
            }
            const bytes = await googleAttachment(userId, c, file);
            created += await queue(
              scope,
              external,
              title,
              [...source, ["Attachment", file.name]],
              "",
              file,
              bytes,
            );
          }
        } else
          created += await queue(
            scope,
            key,
            title,
            source,
            "Subject: " + title + "\n" + plainText(msg.payload ?? {}),
          );
      }
      const saved = await db.from("connector_scan_state").upsert(
        {
          user_id: userId,
          workspace_id: data.workspaceId,
          provider: c,
          account,
          watermark: list.nextPageToken ? lower : upper,
          upper_bound: list.nextPageToken ? upper : null,
          page_token: list.nextPageToken ?? null,
        },
        { onConflict: "user_id,workspace_id,provider,account" },
      );
      if (saved.error) throw Error("Couldn't save checkpoint");
      await markConnection(userId, c, {
        last_sync_at: new Date().toISOString(),
        last_sync_count: created,
        last_error: null,
      });
      return { created, checked: ids.length, alreadyImported: skipped, more: !!list.nextPageToken };
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
            const r = await google(
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
          const r = await google(userId, c, "/calendar/v3/calendars/primary/events", {
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
      const r = await google(
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
      const { queue, eligible, scoped } = await import("./connector-review.server");
      const account = await accountEmail(userId, c);
      if (!account) throw Error("Couldn't identify the connected Drive.");
      const meta = await (
        await google(
          userId,
          c,
          `/drive/v3/files/${data.fileId}?fields=id,name,mimeType,size,modifiedTime`,
        )
      ).json();
      const file = {
        name: meta.name,
        mime: meta.mimeType,
        size: Number(meta.size),
        fileId: data.fileId,
      };
      if (!eligible(file)) return { error: "Choose a PDF, JPEG, PNG or WebP under 4.8 MB." };
      const scope = { user: userId, ws: data.workspaceId, provider: c },
        key = [account, data.fileId, meta.modifiedTime].join(":");
      const seen = await scoped("connector_reviews", scope).eq("external_key", key).maybeSingle();
      if (seen.error) throw Error("Review lookup failed");
      if (seen.data) return { created: 0 };
      const bytes = await googleAttachment(userId, c, file);
      return {
        created: await queue(
          scope,
          key,
          file.name,
          [
            ["Source", "Google Drive"],
            ["Connected account", account],
            ["File name", file.name],
            ["Modified", meta.modifiedTime],
          ],
          "",
          file,
          bytes,
        ),
      };
    } catch (e) {
      return fail(userId, c, e);
    }
  });

async function checkScope(client: Ctx["supabase"], ws: string | null) {
  const access = await client.rpc("can_access_workspace", { _workspace: ws });
  if (access.error || !access.data) throw Error("Workspace unavailable");
}
async function googleAttachment(
  user: string,
  c: GoogleConnector,
  file: import("./connector-review.server").Attachment,
) {
  if (file.message && file.attachmentId) {
    const r = await (
      await google(
        user,
        c,
        "/gmail/v1/users/me/messages/" +
          encodeURIComponent(file.message) +
          "/attachments/" +
          encodeURIComponent(file.attachmentId),
      )
    ).json();
    return Buffer.from(r.data, "base64url");
  }
  return Buffer.from(
    await (
      await google(
        user,
        c,
        "/drive/v3/files/" + encodeURIComponent(file.fileId ?? "") + "?alt=media",
      )
    ).arrayBuffer(),
  );
}
const reviewScope = z.object({
  workspaceId: Ws,
  connector: z.enum(["google_mail", "google_drive"]),
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
      bytes = await googleAttachment(userId, data.connector, draft.attachment);
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
