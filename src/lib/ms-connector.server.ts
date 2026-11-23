import { randomBytes, createHash } from "node:crypto";
import {
  db,
  requireConnectorPlan,
  eligible,
  scoped,
  queue,
  type Attachment,
  type Scope,
} from "./connector-review.server";
import {
  saveConnectionKeyForUser,
  getConnectionKeyForUser,
  markConnection,
} from "@/server/appUserConnections.server";
import { encryptConnectionKey, decryptConnectionKey } from "@/server/connectionKeyCrypto";
import { trustedReturnUrl } from "./app-origin.server";
export type MS = "outlook" | "onedrive";
const base = "https://login.microsoftonline.com/common/oauth2/v2.0/";
const scopes = (p: MS) => "offline_access " + (p === "outlook" ? "Mail.Read" : "Files.Read");
const hash = (s: string) => createHash("sha256").update(s).digest("base64url");
const config = () => {
  const client_id = process.env["MICROSOFT_CONNECTOR_CLIENT_ID"],
    client_secret = process.env["MICROSOFT_CONNECTOR_CLIENT_SECRET"];
  if (!client_id || !client_secret) throw Error("Microsoft connector registration is required.");
  return { client_id, client_secret };
};
export async function start(user: string, p: MS, origin: string) {
  await requireConnectorPlan(user, p);
  const redirect_uri = new URL("/api/oauth/microsoft/return", trustedReturnUrl(origin, "/")).href;
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  const { client_id } = config();
  await db.from("connector_oauth_requests").delete().lt("expires_at", new Date().toISOString());
  const r = await db.from("connector_oauth_requests").insert({
    state_hash: hash(state),
    user_id: user,
    provider: p,
    verifier: encryptConnectionKey(verifier),
    redirect_uri,
  });
  if (r.error) throw Error("Could not start consent.");
  return (
    base +
    "authorize?" +
    new URLSearchParams({
      client_id,
      state,
      redirect_uri,
      response_type: "code",
      scope: scopes(p),
      code_challenge: hash(verifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    })
  );
}
type Grant = { access_token: string; refresh_token: string; expires_at: number };
class MicrosoftConsentRequired extends Error {}
async function exchange(p: MS, fields: Record<string, string>) {
  const body = new URLSearchParams({ ...config(), scope: scopes(p), ...fields });
  const grantType = fields["grant_type"];
  let r: Response;
  try {
    r = await fetch(base + "token", {
      method: "POST",
      body,
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    console.error({
      event: "microsoft_token_failure",
      provider: p,
      grantType,
      status: null,
      classification: "network",
    });
    throw Error("Could not reach Microsoft. Try again.");
  }
  if (!r.ok) {
    const detail = await r.json().catch(() => null);
    const known = [
      "invalid_client",
      "invalid_grant",
      "invalid_scope",
      "unauthorized_client",
      "invalid_request",
      "interaction_required",
      "temporarily_unavailable",
      "server_error",
    ];
    const oauth = known.includes(detail?.error) ? String(detail.error) : "unknown";
    const codes: number[] = Array.isArray(detail?.error_codes)
      ? detail.error_codes
          .filter(
            (n: unknown) =>
              typeof n === "number" && Number.isSafeInteger(n) && n > 0 && n < 100000000,
          )
          .slice(0, 4)
      : [];
    const classifications: Record<number, string> = {
      7000215: "invalid_client_secret",
      7000222: "expired_client_secret",
      700016: "application_not_found",
      50011: "redirect_mismatch",
      501481: "pkce_mismatch",
      70000: "invalid_grant",
      70008: "expired_grant",
      54005: "code_redeemed",
    };
    console.error({
      event: "microsoft_token_failure",
      provider: p,
      grantType,
      status: r.status,
      oauth,
      codes,
      classification: codes.map((n) => classifications[n]).find(Boolean) ?? oauth,
    });
    if (oauth === "invalid_grant" || oauth === "interaction_required")
      throw new MicrosoftConsentRequired(
        "Microsoft consent expired or was revoked. Reconnect to continue.",
      );
    if (oauth === "invalid_client" || oauth === "invalid_scope" || oauth === "unauthorized_client")
      throw Error(
        "Microsoft rejected the connector configuration. Contact your MatrixKeep administrator.",
      );
    throw Error("Microsoft could not complete the connection. Try again.");
  }
  const t = await r.json();
  const refresh_token = t.refresh_token ?? fields["refresh_token"];
  if (typeof t.access_token !== "string" || typeof refresh_token !== "string")
    throw Error("Offline access was not granted.");
  return {
    access_token: t.access_token,
    refresh_token,
    expires_at: Date.now() + Number(t.expires_in) * 1000,
  } satisfies Grant;
}
export async function finish(user: string, p: MS, state: string, code: string) {
  await requireConnectorPlan(user, p);
  const r = await db
    .from("connector_oauth_requests")
    .delete()
    .eq("state_hash", hash(state))
    .eq("user_id", user)
    .eq("provider", p)
    .gt("expires_at", new Date().toISOString())
    .select("redirect_uri,verifier")
    .single();
  if (r.error || !r.data) throw Error("Consent expired. Reconnect to try again.");
  const grant = await exchange(p, {
    grant_type: "authorization_code",
    code,
    redirect_uri: r.data.redirect_uri,
    code_verifier: decryptConnectionKey(r.data.verifier),
  });
  await saveConnectionKeyForUser(user, p, JSON.stringify(grant));
}
async function graph(user: string, p: MS, path: string) {
  await requireConnectorPlan(user, p);
  const encrypted = await getConnectionKeyForUser(user, p);
  if (!encrypted) throw Error("Connect Microsoft first.");
  let grant = JSON.parse(encrypted) as Grant;
  if (grant.expires_at < Date.now() + 60000) {
    const next = await exchange(p, {
      grant_type: "refresh_token",
      refresh_token: grant.refresh_token,
    }).catch(async (e) => {
      if (e instanceof MicrosoftConsentRequired)
        await markConnection(user, p, { reconnect_required: true });
      throw e;
    });
    const r = await db
      .from("app_user_connections")
      .update({ connection_key_ciphertext: encryptConnectionKey(JSON.stringify(next)) })
      .eq("user_id", user)
      .eq("connector_id", p);
    if (r.error) throw Error("Reconnect Microsoft.");
    grant = next;
  }
  const url = new URL(path, "https://graph.microsoft.com/v1.0/");
  if (url.origin !== "https://graph.microsoft.com" || !url.pathname.startsWith("/v1.0/"))
    throw Error("Invalid provider cursor");
  const r = await fetch(url, {
    headers: {
      Authorization: "Bearer " + grant.access_token,
      Prefer: 'outlook.body-content-type="text", IdType="ImmutableId"',
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) {
    await r.body?.cancel();
    if (r.status === 401) await markConnection(user, p, { reconnect_required: true });
    throw Error("Microsoft request failed (" + r.status + ").");
  }
  return r;
}
const enc = encodeURIComponent;
export async function msBytes(user: string, p: MS, file: Attachment) {
  if (!eligible(file)) throw Error("Unsupported attachment");
  const path =
    p === "onedrive"
      ? "me/drive/items/" + enc(file.fileId!) + "/content"
      : "me/messages/" + enc(file.message!) + "/attachments/" + enc(file.attachmentId!) + "/$value";
  const r = await graph(user, p, path);
  const firstOutlookRead = p === "outlook" && !file.hash;
  const limit = firstOutlookRead ? 4800000 : file.size;
  const reader = r.body?.getReader();
  if (!reader) throw Error("Empty file");
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.length;
    if (size > limit) {
      await reader.cancel();
      throw Error("File changed.");
    }
    parts.push(chunk.value);
  }
  if (!size || (!firstOutlookRead && size !== file.size)) throw Error("File changed.");
  return Buffer.concat(parts);
}
export async function browse(user: string, query: string) {
  const segment = query
    ? "root/search(q='" + enc(query.replaceAll("'", "''")) + "')"
    : "root/children";
  const r = await (
    await graph(
      user,
      "onedrive",
      "me/drive/" + segment + "?$top=30&$select=id,name,size,file,lastModifiedDateTime",
    )
  ).json();
  return (
    r.value as {
      id: string;
      name: string;
      size: number;
      lastModifiedDateTime: string;
      file?: { mimeType: string };
    }[]
  )
    .filter((f) => eligible({ name: f.name, mime: f.file?.mimeType ?? "", size: f.size }))
    .map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      mimeType: f.file!.mimeType,
      modifiedTime: f.lastModifiedDateTime,
    }));
}
export async function importMsFile(s: Scope, id: string) {
  const f = await (
    await graph(
      s.user,
      "onedrive",
      "me/drive/items/" + enc(id) + "?$select=id,name,file,size,eTag,parentReference",
    )
  ).json();
  const a = { fileId: id, name: f.name, mime: f.file?.mimeType, size: f.size };
  if (!eligible(a)) throw Error("Choose a supported PDF or photo under 4.8 MB.");
  const key = [f.parentReference?.driveId, id, f.eTag].join(":");
  const seen = await scoped("connector_reviews", s).eq("external_key", key).maybeSingle();
  if (seen.error) throw Error("Review unavailable");
  if (seen.data) return 0;
  return queue(
    s,
    key,
    f.name,
    [
      ["Source", "OneDrive"],
      ["File name", f.name],
    ],
    "",
    a,
    await msBytes(s.user, "onedrive", a),
  );
}
export async function scanOutlook(s: Scope) {
  const folder = await (await graph(s.user, "outlook", "me/mailFolders/inbox?$select=id")).json();
  const account = String(folder.id);
  const { data, error } = await scoped("connector_scan_state", s)
    .eq("account", account)
    .maybeSingle();
  if (error) throw Error("Checkpoint unavailable");
  const since = data?.watermark ?? Math.floor(Date.now() / 1000) - 180 * 86400,
    until = data?.upper_bound ?? Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    $select: "id,subject,sender,receivedDateTime,hasAttachments",
    $filter:
      "receivedDateTime ge " +
      new Date(since * 1000).toISOString() +
      " and receivedDateTime lt " +
      new Date(until * 1000).toISOString(),
    $top: "8",
    $orderby: "receivedDateTime asc",
  });
  const continuation = data?.page_token?.startsWith("{") ? JSON.parse(data.page_token) : null;
  const pageUrl =
    continuation?.page ?? data?.page_token ?? "me/mailFolders/inbox/messages?" + params;
  const page = await (await graph(s.user, "outlook", pageUrl)).json();
  let count = 0,
    candidates = 0,
    skipped = 0;
  let more = page["@odata.nextLink"] ?? null;
  const resumeAt = continuation
    ? page.value.findIndex((m: { id: string }) => m.id === continuation.message)
    : 0;
  for (const m of page.value.slice(Math.max(0, resumeAt))) {
    if (
      !/receipt|invoice|warranty|guarantee|renewal|policy|contract|order confirmation|purchase|subscription/i.test(
        m.subject,
      ) ||
      /newsletter|digest|promotion/i.test(m.subject)
    )
      continue;
    candidates++;
    const prefix = account + ":" + m.id,
      source = [
        ["Source", "Outlook"],
        ["Sender", String(m.sender?.emailAddress?.address ?? "")],
        ["Email subject", m.subject],
        ["Received", m.receivedDateTime],
        ["Message ID", m.id],
      ];
    const path = "me/messages/" + enc(m.id);
    const files = m.hasAttachments
      ? await (
          await graph(
            s.user,
            "outlook",
            (continuation?.message === m.id ? continuation.attachments : null) ??
              path + "/attachments?$select=id,name,size,contentType,isInline&$top=4",
          )
        ).json()
      : { value: [] };

    const attachments: Attachment[] = files.value
      .filter((f: { isInline: boolean }) => !f.isInline)
      .map((f: { id: string; name: string; size: number; contentType: string }) => ({
        message: m.id,
        attachmentId: f.id,
        name: f.name,
        mime: f.contentType,
        size: f.size,
      }))
      .filter(eligible);

    for (const a of attachments.length ||
    files["@odata.nextLink"] ||
    (continuation?.message === m.id && continuation?.hadFiles)
      ? attachments
      : [undefined]) {
      const key = a ? prefix + ":" + a.attachmentId : prefix;
      const seen = await scoped("connector_reviews", s).eq("external_key", key).maybeSingle();
      if (seen.error) throw Error("Review unavailable");
      if (seen.data) {
        skipped++;
        continue;
      }
      if (a) {
        const bytes = await msBytes(s.user, "outlook", a);
        count += await queue(
          s,
          key,
          m.subject,
          [...source, ["Attachment", a.name]],
          "",
          { ...a, size: bytes.length },
          bytes,
        );
      } else {
        const msg = await (await graph(s.user, "outlook", path + "?$select=body")).json();
        count += await queue(
          s,
          key,
          m.subject,
          source,
          m.subject + "\n" + String(msg.body?.content ?? "").slice(0, 9000),
        );
      }
    }
    if (files["@odata.nextLink"]) {
      more = JSON.stringify({
        page: pageUrl,
        message: m.id,
        attachments: files["@odata.nextLink"],
        hadFiles:
          attachments.length > 0 || (continuation?.message === m.id && continuation.hadFiles),
      });
      break;
    }
  }
  const saved = await db.from("connector_scan_state").upsert(
    {
      user_id: s.user,
      workspace_id: s.ws,
      provider: s.provider,
      account,
      watermark: more ? since : until,
      upper_bound: more ? until : null,
      page_token: more,
    },
    { onConflict: "user_id,workspace_id,provider,account" },
  );
  if (saved.error) throw Error("Could not save checkpoint.");
  await markConnection(s.user, "outlook", {
    last_sync_at: new Date().toISOString(),
    last_sync_count: count,
    last_error: null,
  });
  return {
    created: count,
    checked: page.value.length,
    candidates,
    alreadyImported: skipped,
    more: !!more,
  };
}
export async function scanOneDrive(s: Scope) {
  const info = await (await graph(s.user, "onedrive", "me/drive?$select=id")).json();
  const account = String(info.id);
  const st = await scoped("connector_scan_state", s).eq("account", account).maybeSingle();
  if (st.error) throw Error("Checkpoint unavailable");
  const page = await (
    await graph(
      s.user,
      "onedrive",
      st.data?.page_token ?? "me/drive/root/delta?$select=id,name,file,size,deleted&$top=8",
    )
  ).json();
  let created = 0;
  for (const f of page.value ?? [])
    if (
      !f.deleted &&
      f.file &&
      Number(f.size) <= 4800000 &&
      /receipt|contract|warranty|guarantee|policy|invoice|tenancy|renewal|certificate|purchase/i.test(
        f.name,
      )
    )
      created += await importMsFile(s, f.id);
  const next = page["@odata.nextLink"] ?? page["@odata.deltaLink"];
  if (!next) throw Error("Missing OneDrive checkpoint.");
  const r = await db.from("connector_scan_state").upsert(
    {
      user_id: s.user,
      workspace_id: s.ws,
      provider: s.provider,
      account,
      page_token: next,
      watermark: Math.floor(Date.now() / 1000),
    },
    { onConflict: "user_id,workspace_id,provider,account" },
  );
  if (r.error) throw Error("Could not save checkpoint.");
  return { created, more: !!page["@odata.nextLink"] };
}

export async function outlookBody(user: string, id: string) {
  const m = await (await graph(user, "outlook", "me/messages/" + enc(id) + "?$select=body")).json();
  return String(m.body?.content ?? "").slice(0, 9000);
}
