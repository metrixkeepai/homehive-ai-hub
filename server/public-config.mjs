/** Values sent to browsers. Keep this an explicit allowlist. */
export function publicConfig(env) {
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  let anonymous = false;
  try {
    anonymous = JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role === "anon";
  } catch {
    // Modern publishable keys have no JWT payload.
  }
  if (
    !key ||
    key === env.SUPABASE_SERVICE_ROLE_KEY ||
    !(key.startsWith("sb_publishable_") || anonymous)
  )
    throw new Error("A browser-safe Supabase publishable or anon key is required");
  for (const field of ["APP_ORIGIN", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]) {
    if (env[`VITE_${field}`] && env[`VITE_${field}`] !== env[field])
      throw new Error(`Mismatched public configuration: ${field}`);
  }
  const payments = env.VITE_PAYMENTS_CLIENT_TOKEN || "";
  if (
    payments &&
    !(env.STRIPE_ENVIRONMENT === "sandbox" ? /^pk_test_/ : /^pk_live_/).test(payments)
  )
    throw new Error("Stripe publishable key mode mismatch");
  return {
    VITE_APP_ORIGIN: env.APP_ORIGIN,
    VITE_SUPABASE_URL: env.SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: key,
    VITE_PAYMENTS_CLIENT_TOKEN: payments,
  };
}
