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
        .filter((r) => !r.reconnect_required)
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
async function saveRecords(
  supabase: Ctx["supabase"],
  ws: string | null,
  records: {
    section: string;
    title: string;
    subtitle: string;
    fields: { label: string; value: string }[];
  }[],
  source: [string, string][],
) {
  const ids: string[] = [];
  for (const r of records) {
    const { data, error } = await supabase
      .from("home_items")
      .insert({
        workspace_id: ws,
        section: r.section,
        title: r.title.slice(0, 200),
        subtitle: r.subtitle.slice(0, 500),
        fields: [...r.fields.map((f) => [f.label, f.value]), ...source],
      })
      .select("id")
      .single();
    if (!error && data) ids.push(data.id);
  }
  return ids;
}
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
type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
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
      const { getLinks, saveLink, markConnection } =
        await import("@/server/appUserConnections.server");
      const { runExtraction } = await import("./capture.server");
      const q =
        'newer_than:180d (receipt OR invoice OR "order confirmation" OR "your order" OR warranty OR guarantee OR renewal OR "policy documents" OR subscription) -category:promotions';
      const list = (await (
        await google(
          userId,
          c,
          `/gmail/v1/users/me/messages?maxResults=25&q=${encodeURIComponent(q)}`,
        )
      ).json()) as { messages?: { id: string }[] };
      const ids = (list.messages ?? []).map((m) => m.id);
      const prefix = data.workspaceId ?? "personal";
      const seen = await getLinks(
        userId,
        c,
        ids.map((i) => `${prefix}:${i}`),
      );
      const todo = ids.filter((i) => !seen.has(`${prefix}:${i}`)).slice(0, 8);
      let created = 0;
      for (const id of todo) {
        const m = (await (
          await google(userId, c, `/gmail/v1/users/me/messages/${id}?format=full`)
        ).json()) as {
          payload?: Part & { headers?: { name: string; value: string }[] };
          snippet?: string;
        };
        const h = (n: string) =>
          m.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
        const text =
          `Email from: ${h("from")}\nDate: ${h("date")}\nSubject: ${h("subject")}\n\n${(m.payload ? plainText(m.payload) : "") || m.snippet || ""}`.slice(
            0,
            7500,
          );
        const r = await runExtraction(
          {
            workspaceId: data.workspaceId,
            mode: "Gmail import — only extract receipts, invoices, purchase confirmations, warranties or renewals; return no records for marketing or unrelated email",
            text,
          },
          userId,
        );
        let firstId: string | null = null;
        if ("records" in r && r.records.length) {
          const saved = await saveRecords(supabase, data.workspaceId, r.records, [
            ["Source", "Gmail"],
            ["Email subject", h("subject").slice(0, 200)],
            ["Email date", h("date").slice(0, 60)],
          ]);
          created += saved.length;
          firstId = saved[0] ?? null;
        }
        if ("error" in r) continue; // retry this email next sync
        await saveLink(userId, c, `${prefix}:${id}`, firstId, id);
      }
      await markConnection(userId, c, {
        last_sync_at: new Date().toISOString(),
        last_sync_count: created,
        last_error: null,
      });
      return { checked: todo.length, created, alreadyImported: ids.length - todo.length };
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
      const { saveLink, markConnection } = await import("@/server/appUserConnections.server");
      const meta = (await (
        await google(userId, c, `/drive/v3/files/${data.fileId}?fields=id,name,mimeType,size`)
      ).json()) as { name: string; mimeType: string; size?: string };
      if (!(meta.mimeType === "application/pdf" || meta.mimeType.startsWith("image/")))
        return { error: "Only PDFs and photos can be imported." };
      if (Number(meta.size ?? 0) > 20 * 1024 * 1024) return { error: "That file is over 20 MB." };
      const bytes = Buffer.from(
        await (await google(userId, c, `/drive/v3/files/${data.fileId}?alt=media`)).arrayBuffer(),
      );
      const src: [string, string][] = [
        ["Source", "Google Drive"],
        ["File name", meta.name.slice(0, 200)],
      ];
      let records: {
        section: string;
        title: string;
        subtitle: string;
        fields: { label: string; value: string }[];
      }[] = [];
      if (meta.mimeType.startsWith("image/") && bytes.length < 5_000_000) {
        const { runExtraction } = await import("./capture.server");
        const r = await runExtraction(
          {
            workspaceId: data.workspaceId,
            mode: "Google Drive import",
            text: "",
            fileName: meta.name,
            image: `data:${meta.mimeType};base64,${bytes.toString("base64")}`,
          },
          userId,
        );
        if ("records" in r) records = r.records;
      }
      if (!records.some((r) => r.section === "documents"))
        records.unshift({
          section: "documents",
          title: meta.name.replace(/\.[^.]+$/, "").slice(0, 120),
          subtitle: `${meta.mimeType === "application/pdf" ? "PDF" : "Photo"} · from Google Drive`,
          fields: [],
        });
      const ids = await saveRecords(supabase, data.workspaceId, records, src);
      if (!ids.length) return { error: "Couldn't save the imported records." };
      for (const itemId of ids.slice(0, 1)) {
        const path = `${userId}/${itemId}/${crypto.randomUUID()}-${meta.name.replace(/[^\w.-]/g, "_")}`;
        const up = await supabase.storage
          .from("evidence")
          .upload(path, bytes, { contentType: meta.mimeType });
        if (!up.error)
          await supabase.from("evidence_files").insert({
            item_id: itemId,
            path,
            name: meta.name,
            mime: meta.mimeType,
            size: bytes.length,
          });
      }
      await saveLink(
        userId,
        c,
        `${data.workspaceId ?? "personal"}:${data.fileId}`,
        ids[0] ?? null,
        data.fileId,
      );
      await markConnection(userId, c, {
        last_sync_at: new Date().toISOString(),
        last_sync_count: ids.length,
        last_error: null,
      });
      return { created: ids.length, firstId: ids[0] };
    } catch (e) {
      return fail(userId, c, e);
    }
  });
