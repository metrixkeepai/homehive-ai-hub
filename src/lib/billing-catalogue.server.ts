import type Stripe from "stripe";
import { supabaseAdmin as db } from "../integrations/supabase/client.server";
import { resolvePlans } from "./effective-plans";
import { createStripeClient, stripeEnvironment } from "./stripe.server";

export async function withBillingLock<T>(key: string, work: (token: string) => Promise<T>) {
  const claim = await db.rpc("claim_billing_action", { _key: key });
  if (claim.error || !claim.data)
    throw new Error("Billing change already in progress. Please retry.");
  try {
    return await work(claim.data);
  } finally {
    await db.rpc("release_billing_action", { _key: key, _token: claim.data });
  }
}

export async function cataloguePlan(key: string) {
  const { data, error } = await db
    .rpc("effective_plan_catalogue")
    .eq("plan_key", key)
    .maybeSingle();
  if (error) throw new Error("Plan catalogue unavailable");
  return resolvePlans(data ? [data] : []).find((p) => p.key === key);
}

async function rememberPrice(
  price: Stripe.Price,
  key: string,
  product: string,
  interval: "year" | "month",
) {
  if (
    price.unit_amount === null ||
    price.currency !== "gbp" ||
    price.type !== "recurring" ||
    price.recurring?.interval !== interval ||
    price.recurring.interval_count !== 1 ||
    price.product !== product
  )
    throw new Error("Price configuration mismatch");
  const { error } = await db.from("billing_price_history").upsert(
    {
      price_id: price.id,
      plan_key: key,
      product_id: product,
      interval_name: interval,
      amount: price.unit_amount,
      environment: stripeEnvironment(),
    },
    { ignoreDuplicates: true, onConflict: "environment,price_id" },
  );
  if (error) throw new Error("Unable to record immutable price");
}

export async function publishPlanVersion(id: string, admin: string) {
  return withBillingLock("publish-catalogue", async () => {
    const { data: v, error } = await db.from("plan_versions").select("*").eq("id", id).single();
    if (error || !v) throw new Error("Plan version unavailable");
    const key = v.plan_key;
    const before = await cataloguePlan(key);
    const protectedPlan = ["free", "business_free", "enterprise", "whitelabel"].includes(key);
    if (protectedPlan && (v.monthly !== before?.monthly || v.yearly !== before?.yearly))
      throw new Error("This plan uses free or contracted billing");
    if ((v.monthly === 0 && v.yearly !== 0) || (v.yearly === 0 && v.monthly !== 0))
      throw new Error("Free plans must be free for both intervals");
    if (!before && !v.entitlements)
      throw new Error("Provide entitlement settings for the new plan");
    if (!protectedPlan && (!before || before.monthly !== v.monthly || before.yearly !== v.yearly)) {
      const stripe = createStripeClient(stripeEnvironment());
      if (
        stripeEnvironment() === "sandbox" &&
        (await stripe.accounts.retrieveCurrent()).id !== "acct_1USCeXCvVNDP3ZsF"
      )
        throw new Error("Unexpected sandbox account");
      const productId = "matrixkeep_" + key;
      let product;
      try {
        product = await stripe.products.retrieve(productId);
      } catch (e) {
        if ((e as { code?: string }).code !== "resource_missing") throw e;
        product = await stripe.products.create(
          { id: productId, name: v.name, metadata: { app: "matrixkeep", plan: key } },
          { idempotencyKey: "mk-product-" + key },
        );
      }
      if (product.metadata["app"] !== "matrixkeep" || product.metadata["plan"] !== key)
        throw new Error("Product ownership mismatch");
      const active: string[] = [];
      for (const label of ["monthly", "yearly"] as const) {
        const interval = label === "monthly" ? "month" : "year";
        const lookup = key + "_" + label;
        const amount = Math.round((v[label] ?? 0) * 100);
        const result = await stripe.prices.list({ lookup_keys: [lookup], limit: 2 });
        const old = result.data[0];
        if (result.data.length > 1) throw new Error("Duplicate Stripe lookup");
        if (old) {
          if (
            old.unit_amount !== Math.round((before?.[label] ?? 0) * 100) &&
            old.unit_amount !== amount
          )
            throw new Error("Unexpected prior price");
          await rememberPrice(old, key, productId, interval);
        }
        if (amount <= 0) {
          if (old?.active) await stripe.prices.update(old.id, { active: false });
          continue;
        }
        if (old?.unit_amount === amount) {
          if (!old.active) await stripe.prices.update(old.id, { active: true });
          active.push(old.id);
          continue;
        }
        const price = await stripe.prices.create(
          {
            product: productId,
            currency: "gbp",
            unit_amount: amount,
            recurring: { interval, interval_count: 1 },
            lookup_key: lookup,
            transfer_lookup_key: true,
          },
          { idempotencyKey: "mk-price-" + id + "-" + label },
        );
        await rememberPrice(price, key, productId, interval);
        if (old) await stripe.prices.update(old.id, { active: false });
        active.push(price.id);
      }
      // Reconcile previous prices even after a partial failure following lookup transfer.
      for await (const price of stripe.prices.list({
        product: productId,
        active: true,
        limit: 100,
      })) {
        if (active.includes(price.id)) continue;
        const saved = await db
          .from("billing_price_history")
          .select("price_id")
          .eq("environment", stripeEnvironment())
          .eq("price_id", price.id)
          .maybeSingle();
        if (saved.error) throw new Error("Price lookup failed");
        if (saved.data) await stripe.prices.update(price.id, { active: false });
      }
      const configs = await stripe.billingPortal.configurations.list({
        active: true,
        is_default: true,
        limit: 1,
      });
      const config = configs.data[0];
      if (!config || config.metadata?.["app"] !== "matrixkeep")
        throw new Error("Configure MatrixKeep's billing portal before publishing prices");
      const products = (config.features.subscription_update.products ?? [])
        .filter((p) => p.product !== productId)
        .map((p) => ({ product: p.product, prices: p.prices }));
      if (active.length) products.push({ product: productId, prices: active });
      await stripe.billingPortal.configurations.update(config.id, {
        features: {
          subscription_update: {
            enabled: products.length > 0,
            default_allowed_updates: ["price"],
            products,
          },
        },
      });
    }
    const approved = await db.rpc("approve_catalogue_version", { _id: id, _admin: admin });
    if (approved.error) throw new Error("Plan publication failed. Retry this version.");
  });
}
