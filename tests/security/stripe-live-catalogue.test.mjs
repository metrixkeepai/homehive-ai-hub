import assert from "node:assert/strict";
import test from "node:test";
import { reconcileLiveCatalogue } from "../../scripts/reconcile-live-catalogue.mjs";

const merchant = "acct_fixture";
function client() {
  const products = [],
    prices = [];
  const list = (rows) =>
    async function* ({ active }) {
      yield* rows.filter((item) => item.active === active);
    };
  return {
    accounts: { retrieveCurrent: async () => ({ id: merchant }) },
    products: {
      rows: products,
      list: list(products),
      create: async (p) => products.push({ ...p, active: true, livemode: true }),
    },
    prices: {
      rows: prices,
      list: list(prices),
      create: async (p) =>
        prices.push({
          ...p,
          active: true,
          livemode: true,
          type: "recurring",
          billing_scheme: "per_unit",
          recurring: { interval_count: 1, usage_type: "licensed", ...p.recurring },
        }),
    },
  };
}

test("dry run creates nothing, apply creates exactly the 14 approved GBP prices, replay is a no-op", async () => {
  const stripe = client();
  assert.equal((await reconcileLiveCatalogue(stripe, merchant)).missing.length, 21);
  assert.equal(stripe.products.rows.length, 0);
  assert.equal((await reconcileLiveCatalogue(stripe, merchant, true)).created.length, 21);
  assert.deepEqual(
    Object.fromEntries(stripe.prices.rows.map((p) => [p.lookup_key, p.unit_amount])),
    {
      home_monthly: 499,
      home_yearly: 4900,
      plus_monthly: 999,
      plus_yearly: 9900,
      family_monthly: 1499,
      family_yearly: 14900,
      business_starter_monthly: 1900,
      business_starter_yearly: 19000,
      business_monthly: 2900,
      business_yearly: 29000,
      business_pro_monthly: 7900,
      business_pro_yearly: 79000,
      business_scale_monthly: 14900,
      business_scale_yearly: 149000,
    },
  );
  assert.ok(stripe.prices.rows.every((p) => p.currency === "gbp"));
  assert.deepEqual((await reconcileLiveCatalogue(stripe, merchant, true)).created, []);
});

test("wrong account, archived lookups, duplicate names or wrong ownership block all mutations", async () => {
  const stripe = client();
  await assert.rejects(
    reconcileLiveCatalogue(stripe, "acct_other", true),
    /merchant account mismatch/,
  );
  stripe.prices.rows.push({ active: false, lookup_key: "business_scale_yearly" });
  await assert.rejects(reconcileLiveCatalogue(stripe, merchant, true), /business_scale_yearly/);
  assert.equal(stripe.products.rows.length, 0);
  stripe.prices.rows.length = 0;
  stripe.products.rows.push({
    active: true,
    id: "prod_other",
    name: "MatrixKeep Family",
    metadata: {},
  });
  await assert.rejects(reconcileLiveCatalogue(stripe, merchant, true), /ownership/);
  assert.equal(stripe.prices.rows.length, 0);
});
