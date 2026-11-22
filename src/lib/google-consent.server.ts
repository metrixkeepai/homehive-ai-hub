import { randomBytes, createHash } from "node:crypto";
import { db } from "./connector-review.server";
import { trustedReturnUrl } from "./app-origin.server";
import { encryptConnectionKey, decryptConnectionKey } from "@/server/connectionKeyCrypto";
import {
  saveConnectionKeyForUser,
  getConnectionKeyForUser,
  markConnection,
  deleteConnectionForUser,
} from "@/server/appUserConnections.server";
import { GOOGLE, type GoogleConnector } from "./google-config";
const hash = (s: string) => createHash("sha256").update(s).digest("base64url");
function config() {
  const client_id = process.env["GOOGLE_CONNECTOR_CLIENT_ID"],
    client_secret = process.env["GOOGLE_CONNECTOR_CLIENT_SECRET"];
  if (!client_id || !client_secret) throw Error("Google connector registration is required.");
  return { client_id, client_secret };
}
type Grant = { access_token: string; refresh_token: string; expires_at: number };
export async function beginConsent(
  user: string,
  provider: GoogleConnector,
  origin: string | undefined,
) {
  const redirect_uri = new URL("/api/oauth/google/return", trustedReturnUrl(origin, "/")).href;
  const { client_id } = config(),
    state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  const r = await db.from("connector_oauth_requests").insert({
    user_id: user,
    provider,
    state_hash: hash(state),
    verifier: encryptConnectionKey(verifier),
    redirect_uri,
  });
  if (r.error) throw Error("Could not start Google consent.");
  const params = new URLSearchParams({
    client_id,
    redirect_uri,
    response_type: "code",
    scope: GOOGLE[provider].scopes.join(" "),
    state,
    code_challenge: hash(verifier),
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent select_account",
  });
  return { state, authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?" + params };
}
async function exchange(provider: GoogleConnector, fields: Record<string, string>): Promise<Grant> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ ...config(), ...fields }),
    signal: AbortSignal.timeout(20000),
  });
  const v = await r.json();
  if (!r.ok)
    throw Error(v.error === "invalid_grant" ? "RECONNECT" : "Google token service is unavailable.");
  const refresh = v.refresh_token ?? fields["refresh_token"];
  if (
    typeof refresh !== "string" ||
    typeof v.access_token !== "string" ||
    !(Number(v.expires_in) > 0)
  )
    throw Error("Reconnect Google to grant offline access.");
  const granted = new Set(String(v.scope ?? "").split(" "));
  if (
    (fields["grant_type"] === "authorization_code" || v.scope) &&
    !GOOGLE[provider].scopes.every((x) => granted.has(x))
  )
    throw Error("The selected Google permission was not granted.");
  return {
    access_token: v.access_token,
    refresh_token: refresh,
    expires_at: Date.now() + Number(v.expires_in) * 1000,
  };
}
export async function finishGoogle(
  user: string,
  provider: GoogleConnector,
  state: string,
  code: string,
) {
  const r = await db
    .from("connector_oauth_requests")
    .delete()
    .eq("user_id", user)
    .eq("provider", provider)
    .eq("state_hash", hash(state))
    .gt("expires_at", new Date().toISOString())
    .select("verifier,redirect_uri")
    .single();
  if (r.error || !r.data) throw Error("Consent expired. Reconnect to try again.");
  const grant = await exchange(provider, {
    grant_type: "authorization_code",
    code,
    redirect_uri: r.data.redirect_uri,
    code_verifier: decryptConnectionKey(r.data.verifier),
  });
  await saveConnectionKeyForUser(user, provider, JSON.stringify(grant));
}
export async function googleAccess(user: string, p: GoogleConnector) {
  const row = await db
    .from("app_user_connections")
    .select("connection_key_ciphertext,reconnect_required")
    .eq("user_id", user)
    .eq("connector_id", p)
    .maybeSingle();
  if (row.error) throw Error("Could not read connection.");
  if (!row.data) throw Error("NOT_CONNECTED");
  if (row.data.reconnect_required) throw Error("RECONNECT");
  let g: Grant;
  try {
    g = JSON.parse(decryptConnectionKey(row.data.connection_key_ciphertext));
  } catch {
    await markConnection(user, p, { reconnect_required: true });
    throw Error("RECONNECT");
  }
  if (g.expires_at > Date.now() + 60000) return g.access_token;
  try {
    const next = await exchange(p, { grant_type: "refresh_token", refresh_token: g.refresh_token });
    const updated = await db
      .from("app_user_connections")
      .update({ connection_key_ciphertext: encryptConnectionKey(JSON.stringify(next)) })
      .eq("user_id", user)
      .eq("connector_id", p)
      .eq("connection_key_ciphertext", row.data.connection_key_ciphertext)
      .select("user_id")
      .maybeSingle();
    if (updated.error || !updated.data) throw Error("Connection changed. Retry the request.");
    return next.access_token;
  } catch (e) {
    if (e instanceof Error && e.message === "RECONNECT")
      await markConnection(user, p, { reconnect_required: true });
    throw e;
  }
}
export async function disconnect(user: string, p: GoogleConnector) {
  const key = await getConnectionKeyForUser(user, p);
  // Remove local authorisation and queued jobs even when the provider is unavailable.
  await deleteConnectionForUser(user, p);
  if (!key) return { revoked: true };
  try {
    const g = JSON.parse(key) as Grant;
    const r = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      body: new URLSearchParams({ token: g.refresh_token }),
      signal: AbortSignal.timeout(10000),
    });
    return { revoked: r.ok };
  } catch {
    return { revoked: false };
  }
}
