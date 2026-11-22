import { GOOGLE, GATEWAY, type GoogleConnector } from "./google-config";
/** Call Google as the signed-in user; marks the connection for reconnect when the grant is no longer valid. */
export async function google(
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

export async function accountEmail(userId: string, c: GoogleConnector): Promise<string | null> {
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

export async function googleAttachment(
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
export async function scanGmail(userId: string, workspaceId: string | null) {
  const c = "google_mail";
  const { scoped, db, queue, eligible } = await import("./connector-review.server");
  const { getLinks, markConnection } = await import("@/server/appUserConnections.server");
  const scope = { user: userId, ws: workspaceId, provider: c };

  const account = await accountEmail(userId, c);
  if (!account) throw Error("Couldn't identify the connected mailbox.");
  const state = await scoped("connector_scan_state", scope).eq("account", account).maybeSingle();
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
    prefix = workspaceId ?? "personal";
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
    const existing = await scoped("connector_reviews", scope).eq("external_key", key).maybeSingle();
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
      workspace_id: workspaceId,
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
}
export async function importDrive(userId: string, workspaceId: string | null, fileId: string) {
  const c = "google_drive";
  const { queue, eligible, scoped } = await import("./connector-review.server");
  const account = await accountEmail(userId, c);
  if (!account) throw Error("Couldn't identify the connected Drive.");
  const meta = await (
    await google(userId, c, `/drive/v3/files/${fileId}?fields=id,name,mimeType,size,modifiedTime`)
  ).json();
  const file = {
    name: meta.name,
    mime: meta.mimeType,
    size: Number(meta.size),
    fileId: fileId,
  };
  if (!eligible(file)) return { error: "Choose a PDF, JPEG, PNG or WebP under 4.8 MB." };
  const scope = { user: userId, ws: workspaceId, provider: c },
    key = [account, fileId, meta.modifiedTime].join(":");
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
}
export async function scanDrive(user: string, ws: string | null) {
  const { scoped, db } = await import("./connector-review.server");
  const provider = "google_drive",
    account = await accountEmail(user, provider);
  if (!account) throw Error("Connect Drive first.");
  const state = await scoped("connector_scan_state", { user, ws, provider })
    .eq("account", account)
    .maybeSingle();
  if (state.error) throw Error("Checkpoint unavailable");
  const lower = Number(state.data?.watermark) || Math.floor(Date.now() / 1000) - 180 * 86400,
    upper = Number(state.data?.upper_bound) || Math.floor(Date.now() / 1000);
  const q =
    "trashed=false and modifiedTime >= '" +
    new Date(lower * 1000).toISOString() +
    "' and modifiedTime < '" +
    new Date(upper * 1000).toISOString() +
    "' and (mimeType='application/pdf' or mimeType contains 'image/')";
  const params = new URLSearchParams({
    q,
    pageSize: "10",
    orderBy: "modifiedTime",
    fields: "nextPageToken,files(id,name,size,mimeType)",
  });
  if (state.data?.page_token) params.set("pageToken", state.data.page_token);
  const page = await (await google(user, provider, "/drive/v3/files?" + params)).json();
  let created = 0;
  for (const f of page.files ?? []) {
    if (
      !/receipt|contract|warranty|guarantee|policy|invoice|tenancy|renewal|certificate|purchase/i.test(
        f.name,
      ) ||
      Number(f.size) > 4800000
    )
      continue;
    const r = await importDrive(user, ws, f.id);
    if ("error" in r) continue;
    created += r.created;
  }
  const saved = await db.from("connector_scan_state").upsert(
    {
      user_id: user,
      workspace_id: ws,
      provider,
      account,
      watermark: page.nextPageToken ? lower : upper,
      upper_bound: page.nextPageToken ? upper : null,
      page_token: page.nextPageToken ?? null,
    },
    { onConflict: "user_id,workspace_id,provider,account" },
  );
  if (saved.error) throw Error("Checkpoint unavailable");
  return { created, more: !!page.nextPageToken };
}

export async function googleBody(user: string, id: string) {
  const msg = await (
    await google(
      user,
      "google_mail",
      "/gmail/v1/users/me/messages/" + encodeURIComponent(id) + "?format=full",
    )
  ).json();
  return plainText(msg.payload ?? {});
}
