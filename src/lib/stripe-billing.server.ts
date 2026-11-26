import type Stripe from "stripe";
import { supabaseAdmin } from "../integrations/supabase/client.server";
import { cataloguePlan } from "./billing-catalogue.server";
import type { StripeEnv } from "./stripe.server";

// Checkout may accept a charge only while the webhook database can apply its entitlement.
export async function requireBillingEnvironment(environment: StripeEnv) {
  const { data, error } = await supabaseAdmin
    .from("runtime_limits")
    .select("billing_environment")
    .eq("singleton", true)
    .single();
  if (error || data?.billing_environment !== environment)
    throw new Error("Billing database environment mismatch");
}

export async function existingCustomer(userId: string, environment: StripeEnv) {
  const { data, error } = await supabaseAdmin
    .from("billing_customers")
    .select("customer_id")
    .eq("user_id", userId)
    .eq("environment", environment)
    .maybeSingle();
  if (error) throw new Error("Billing lookup failed");
  return data?.customer_id;
}
export async function customerForUser(
  stripe: Stripe,
  userId: string,
  environment: StripeEnv,
  email?: string,
) {
  const existing = await existingCustomer(userId, environment);
  if (existing) return existing;
  // Never bind by mutable/unverified email or overwrite an existing customer's ownership.
  const customer = await stripe.customers.create(
    { ...(email ? { email } : {}), metadata: { userId, app: "matrixkeep" } },
    { idempotencyKey: `matrixkeep-customer-${environment}-${userId}` },
  );
  const { error } = await supabaseAdmin
    .from("billing_customers")
    .upsert(
      { user_id: userId, environment, customer_id: customer.id },
      { onConflict: "user_id,environment", ignoreDuplicates: true },
    );
  if (error) throw new Error("Billing binding failed");
  const bound = await existingCustomer(userId, environment);
  if (!bound) throw new Error("Billing binding failed");
  return bound;
}
export async function validatedPrice(stripe: Stripe, lookup: string) {
  const match = /^(.+)_(monthly|yearly)$/.exec(lookup);
  if (!match) throw new Error("Unknown plan");
  const plan = await cataloguePlan(match[1]!);
  const amount = match[2] === "yearly" ? plan?.yearly : plan?.monthly;
  if (!amount || amount <= 0) throw new Error("Unavailable billing interval");
  const expected = Math.round(amount * 100);
  const found = await stripe.prices.list({
    lookup_keys: [lookup],
    active: true,
    limit: 2,
    expand: ["data.product"],
  });
  const price = found.data[0];
  const product = price?.product;
  if (
    found.data.length !== 1 ||
    !price ||
    price.type !== "recurring" ||
    price.currency !== "gbp" ||
    price.unit_amount !== expected ||
    price.recurring?.interval !== (match[2] === "yearly" ? "year" : "month") ||
    price.recurring.interval_count !== 1 ||
    !product ||
    typeof product === "string" ||
    "deleted" in product ||
    product.metadata["app"] !== "matrixkeep" ||
    product.metadata["plan"] !== match[1]
  )
    throw new Error("Price configuration mismatch");
  return price;
}
