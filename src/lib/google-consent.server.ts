import { randomBytes, createHash } from "node:crypto";
import { db } from "./connector-review.server";
import { trustedReturnUrl } from "./app-origin.server";
import type { GoogleConnector } from "./google-config";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export async function beginConsent(
  user: string,
  provider: GoogleConnector,
  origin: string | undefined,
) {
  const url = new URL("/api/oauth/google/return", trustedReturnUrl(origin, "/"));
  const state = randomBytes(32).toString("base64url");
  const r = await db.from("connector_oauth_requests").insert({
    user_id: user,
    provider,
    state_hash: hash(state),
    verifier: "gateway",
    redirect_uri: url.href,
  });
  if (r.error) throw Error("Could not start Google consent.");
  url.searchParams.set("mkstate", state);
  return { state, returnUrl: url.href };
}
export async function consumeConsent(user: string, provider: GoogleConnector, state: string) {
  const r = await db
    .from("connector_oauth_requests")
    .delete()
    .eq("user_id", user)
    .eq("provider", provider)
    .eq("state_hash", hash(state))
    .gt("expires_at", new Date().toISOString())
    .select("provider")
    .single();
  if (r.error || !r.data) throw Error("This Google consent request expired. Please reconnect.");
}
