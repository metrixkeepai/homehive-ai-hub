export function validateEnvironment(env) {
  const required = [
    "APP_ENV",
    "APP_ORIGIN",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "STRIPE_ENVIRONMENT",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ];
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
  if (env.APP_ENV === "staging" && env.STRIPE_ENVIRONMENT !== "sandbox")
    throw new Error("Staging requires sandbox Stripe");
  if (env.APP_ENV === "production" && env.STRIPE_ENVIRONMENT !== "live")
    throw new Error("Production requires live Stripe");
  const prefix = env.STRIPE_ENVIRONMENT === "live" ? /^(sk|rk)_live_/ : /^(sk|rk)_test_/;
  if (!prefix.test(env.STRIPE_SECRET_KEY)) throw new Error("Stripe key mode mismatch");
  if (!env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_"))
    throw new Error("Invalid webhook secret configuration");
  for (const key of Object.keys(env))
    if (key.startsWith("VITE_") && /SECRET|SERVICE_ROLE|OPENAI_API|PRIVATE/.test(key))
      throw new Error(`Unsafe public variable: ${key}`);
}
