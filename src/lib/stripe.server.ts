import Stripe from "stripe";
export type StripeEnv = "sandbox" | "live";
export function stripeEnvironment(): StripeEnv {
  const value = process.env["STRIPE_ENVIRONMENT"];
  if (value !== "sandbox" && value !== "live")
    throw new Error("STRIPE_ENVIRONMENT is not configured");
  return value;
}
export function createStripeClient(environment: StripeEnv): Stripe {
  if (environment !== stripeEnvironment()) throw new Error("Payment environment is not allowed");
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key || !(environment === "sandbox" ? /^(sk|rk)_test_/ : /^(sk|rk)_live_/).test(key))
    throw new Error("Stripe credentials are not configured for this environment");
  return new Stripe(key, { apiVersion: "2026-08-26.dahlia", maxNetworkRetries: 2, timeout: 15000 });
}
export function getStripeErrorMessage(error: unknown): string {
  if (error instanceof Error && /origin is not allowed|APP_ORIGIN/.test(error.message))
    return error.message;
  return "Billing is unavailable. Please try again or contact support.";
}
export async function verifyWebhook(
  request: Request,
  environment: StripeEnv,
): Promise<Stripe.Event> {
  const stripe = createStripeClient(environment);
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) throw new Error("Webhook is not configured or signed");
  const body = await request.text();
  if (body.length > 1_000_000) throw new Error("Webhook too large");
  const event = await stripe.webhooks.constructEventAsync(body, signature, secret, 300);
  if (event.livemode !== (environment === "live")) throw new Error("Webhook environment mismatch");
  return event;
}
