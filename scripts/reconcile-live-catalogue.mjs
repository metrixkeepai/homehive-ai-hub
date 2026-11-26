// Run under Node 24 with APP_ENV=production, STRIPE_ENVIRONMENT=live,
// STRIPE_SECRET_KEY and the owner-approved STRIPE_ACCOUNT_ID. Default is read-only.
// Add --apply to create missing objects after validating the entire catalogue.
import { plans } from "../src/lib/plans.ts";
import { createStripeClient } from "../src/lib/stripe.server.ts";

const paidKeys = [
  "home",
  "plus",
  "family",
  "business_starter",
  "business",
  "business_pro",
  "business_scale",
];
const normalize = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/^matrixkeep[\s:-]+/, "");
const intervals = { monthly: "month", yearly: "year" };

async function listAll(resource) {
  const objects = [];
  for (const active of [true, false]) {
    for await (const object of resource.list({ active, limit: 100 })) objects.push(object);
  }
  return objects;
}

function requiredObjects(products, prices) {
  const creates = [];
  for (const key of paidKeys) {
    const plan = plans.find((p) => p.key === key);
    const id = "matrixkeep_" + key;
    const metadata = { app: "matrixkeep", plan: key };
    const matching = products.filter(
      (p) =>
        p.id === id ||
        normalize(p.name) === normalize(plan.name) ||
        (p.metadata.app === metadata.app && p.metadata.plan === key),
    );
    const [product] = matching;
    // The plan publisher uses this deterministic product ID. Never adopt or duplicate a
    // namesake, an archived product, or a legacy noncanonical product automatically.
    if (
      matching.length > 1 ||
      (product &&
        (product.id !== id ||
          !product.livemode ||
          !product.active ||
          product.metadata.app !== metadata.app ||
          product.metadata.plan !== key))
    ) {
      throw new Error("Product ownership or active-state conflict for " + key);
    }
    if (!product)
      creates.push({ type: "products", params: { id, name: plan.name, metadata }, key: id });

    for (const [suffix, interval] of Object.entries(intervals)) {
      const lookup = key + "_" + suffix;
      const amount = Math.round(plan[suffix] * 100);
      if (!Number.isSafeInteger(amount) || amount <= 0)
        throw new Error("Missing paid catalogue amount for " + lookup);
      const matches = prices.filter(
        (p) =>
          p.lookup_key === lookup ||
          (p.active && p.product === id && p.recurring?.interval === interval),
      );
      const [price] = matches;
      if (
        matches.length > 1 ||
        (price &&
          (!product ||
            !price.active ||
            !price.livemode ||
            price.lookup_key !== lookup ||
            price.product !== id ||
            price.currency !== "gbp" ||
            price.type !== "recurring" ||
            price.unit_amount !== amount ||
            price.billing_scheme !== "per_unit" ||
            price.recurring?.interval !== interval ||
            price.recurring?.interval_count !== 1 ||
            price.recurring?.usage_type !== "licensed" ||
            price.transform_quantity ||
            (price.metadata.app && price.metadata.app !== metadata.app) ||
            (price.metadata.plan && price.metadata.plan !== key)))
      ) {
        throw new Error("Existing price conflicts with the approved catalogue for " + lookup);
      }
      if (!price) {
        creates.push({
          type: "prices",
          key: lookup,
          params: {
            product: id,
            currency: "gbp",
            unit_amount: amount,
            recurring: { interval },
            lookup_key: lookup,
            metadata,
          },
        });
      }
    }
  }
  return creates;
}

export async function reconcileLiveCatalogue(stripe, accountId, apply = false) {
  if (!/^acct_[a-zA-Z0-9]+$/.test(accountId ?? ""))
    throw new Error("Set the approved Stripe merchant account ID");
  if ((await stripe.accounts.retrieveCurrent()).id !== accountId)
    throw new Error("Live merchant account mismatch");
  const inspect = async () =>
    requiredObjects(...(await Promise.all([listAll(stripe.products), listAll(stripe.prices)])));
  const creates = await inspect();
  if (apply && creates.length) {
    for (const step of creates) {
      // Stripe enforces product IDs and lookup-key uniqueness. Omit transfer_lookup_key:
      // if a concurrent operation takes the key, fail rather than moving it.
      await stripe[step.type].create(step.params, {
        idempotencyKey: "mk-live-bootstrap-v1-" + step.key,
      });
    }
    if ((await inspect()).length) throw new Error("Live catalogue did not pass readback");
  }
  return {
    account: accountId,
    mode: "live",
    applied: apply,
    [apply ? "created" : "missing"]: creates.map((x) => x.key),
  };
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length && args[0] !== "--apply"))
      throw new Error("Expected no arguments or --apply");
    if (process.env.APP_ENV !== "production") throw new Error("Expected APP_ENV=production");
    const result = await reconcileLiveCatalogue(
      createStripeClient("live"),
      process.env.STRIPE_ACCOUNT_ID,
      args[0] === "--apply",
    );
    console.log(JSON.stringify(result));
  } catch (error) {
    // Never serialize Stripe errors, headers, request bodies or credentials.
    console.error(
      error.type ? "Stripe catalogue request failed: " + (error.code || error.type) : error.message,
    );
    process.exitCode = 1;
  }
}
