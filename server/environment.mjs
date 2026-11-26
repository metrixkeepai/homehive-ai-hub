export function validateEnvironment(env) {
  const required = [
    "APP_ENV",
    "APP_ORIGIN",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_ENVIRONMENT",
  ];
  const disabled =
    env.PAYMENTS_ENABLED === "false" ||
    (env.APP_ENV === "production" && env.STRIPE_ENVIRONMENT === "disabled");
  if (!disabled)
    required.push("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "VITE_PAYMENTS_CLIENT_TOKEN");
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing configuration: ${missing.join(", ")}`);
  if (!["staging", "production", "test"].includes(env.APP_ENV)) throw new Error("Invalid APP_ENV");
  for (const key of ["APP_ORIGIN", "SUPABASE_URL"]) {
    const url = new URL(env[key]);
    if (
      url.origin !== env[key] ||
      url.username ||
      url.password ||
      (url.protocol !== "https:" &&
        !(env.APP_ENV === "test" && ["localhost", "127.0.0.1"].includes(url.hostname)))
    )
      throw new Error(`Invalid ${key}`);
  }
  const stageRef = "cdfpupivjjamhvmfcvry";
  if (env.EXPECTED_SUPABASE_REF) {
    if (
      env.SUPABASE_URL !== `https://${env.EXPECTED_SUPABASE_REF}.supabase.co` ||
      (env.APP_ENV === "staging") !== (env.EXPECTED_SUPABASE_REF === stageRef)
    )
      throw new Error("Supabase project does not match the deployment environment");
  }
  if (env.APP_ENV === "staging" && env.STRIPE_ENVIRONMENT !== "sandbox")
    throw new Error("Staging requires sandbox Stripe");
  if (env.APP_ENV === "production" && !["live", "disabled"].includes(env.STRIPE_ENVIRONMENT))
    throw new Error("Production requires live Stripe");
  const prefix = env.STRIPE_ENVIRONMENT === "live" ? /^(sk|rk)_live_/ : /^(sk|rk)_test_/;
  if (
    disabled &&
    (env.STRIPE_SECRET_KEY || env.STRIPE_WEBHOOK_SECRET || env.VITE_PAYMENTS_CLIENT_TOKEN)
  )
    throw new Error("Disabled billing requires Stripe credentials to be unbound");
  if (!disabled && !prefix.test(env.STRIPE_SECRET_KEY)) throw new Error("Stripe key mode mismatch");
  if (!disabled && !env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_"))
    throw new Error("Invalid webhook secret configuration");
  for (const key of Object.keys(env))
    if (key.startsWith("VITE_") && /SECRET|SERVICE_ROLE|OPENAI_API|PRIVATE/.test(key))
      throw new Error(`Unsafe public variable: ${key}`);
}

export async function verifyLiveStripeAccount(env, request = fetch) {
  if (env.APP_ENV !== "production" || env.STRIPE_ENVIRONMENT !== "live") return;
  if (!/^acct_[a-zA-Z0-9]+$/.test(env.STRIPE_ACCOUNT_ID || ""))
    throw new Error("Missing or invalid production STRIPE_ACCOUNT_ID");
  const response = await request("https://api.stripe.com/v1/account", {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok || (await response.json()).id !== env.STRIPE_ACCOUNT_ID)
    throw new Error("Production Stripe account verification failed");
}
