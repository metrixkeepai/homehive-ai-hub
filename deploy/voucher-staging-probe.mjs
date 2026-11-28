// Executed inside the private staging QA job, using the service's pinned sandbox credential.
import assert from "node:assert/strict";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
const e = process.env;
const base = "https://matrixkeep-staging-web-893477687403.europe-west2.run.app";
assert.equal(e.APP_ENV, "staging");
assert.equal(new URL(e.SUPABASE_URL).hostname, "cdfpupivjjamhvmfcvry.supabase.co");
assert.match(e.STRIPE_SECRET_KEY, /^(rk|sk)_test_/);
const db = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const stripe = new Stripe(e.STRIPE_SECRET_KEY, { apiVersion: "2026-08-26.dahlia" });
async function result(name, outcome) {
  const r = await db
    .from("release_qa_checks")
    .insert({ run_id: e.QA_RUN, check_name: name, outcome });
  assert.ifError(r.error);
}
let operation = "sandbox price";
try {
  const price = (
    await stripe.prices.list({ lookup_keys: ["family_monthly"], active: true, limit: 1 })
  ).data[0];
  assert.equal(price.unit_amount, 1499);
  assert.equal(price.livemode, false);
  const expires = Math.floor(Date.now() / 1000) + 2400;
  operation = "POST /v1/coupons";
  const coupon = await stripe.coupons.create({
    name: "MatrixKeep private staging QA",
    duration: "forever",
    percent_off: 90,
    applies_to: { products: [price.product] },
    max_redemptions: 1,
    redeem_by: expires,
    metadata: { app: "matrixkeep", environment: "sandbox", qa_run: e.QA_RUN },
  });
  await result(operation, "PASS");
  operation = "POST /v1/checkout/sessions";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ui_mode: "embedded_page",
    adaptive_pricing: { enabled: false },
    line_items: [{ price: price.id, quantity: 1 }],
    return_url: base + "/app/plans",
    expires_at: expires,
    discounts: [{ coupon: coupon.id }],
    metadata: { app: "matrixkeep", qa_run: e.QA_RUN },
  });
  assert.equal(session.amount_total, 150);
  await stripe.checkout.sessions.expire(session.id);
  await result(operation, "PASS 1499 minus 1349 equals 150 pence");
} catch (err) {
  const safe = (s) => (typeof s === "string" && /^[a-zA-Z0-9_.\[\]-]{1,80}$/.test(s) ? s : "");
  const permissions = [...new Set(String(err.message).match(/rak_[a-z_]+/g) ?? [])];
  await result(
    operation,
    [err.statusCode, safe(err.type), safe(err.code), safe(err.param), ...permissions]
      .filter(Boolean)
      .join(" ") || "Unexpected sandbox total",
  );
  process.exitCode = 1;
}
let step = "Business account fixture";
const browser = await chromium.launch();
try {
  const email = "metrixkeepai+qa-" + randomUUID() + "@gmail.com",
    password = randomUUID() + randomUUID();
  const user = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { account_type: "business", full_name: "Staging billing QA" },
  });
  assert.ifError(user.error);
  const p = await browser.newPage();
  await p.goto(base + "/auth");
  await p.locator("form[data-interactive=true]").waitFor();
  await p.locator("input[type=email]").fill(email);
  await p.locator("input[type=password]").fill(password);
  await p.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL(/\/app(?:\/|$)/);
  step = "Business Free Plans and Billing";
  for (const route of ["/app/plans", "/app/billing"]) {
    await p.goto(base + route);
    await p.getByText("Business Free", { exact: true }).filter({ visible: true }).first().waitFor();
  }
  await result(step, "PASS");
  const title = "QA location " + e.QA_RUN;
  const save = async (v) => {
    await p.getByRole("button", { name: "Add location", exact: true }).click();
    await p.getByLabel("Location name").fill(v);
    await p.getByRole("button", { name: "Save location", exact: true }).click();
  };
  step = "First location save and reopen";
  await p.goto(base + "/app/locations");
  await save(title);
  await p.getByText(title, { exact: true }).first().waitFor();
  await p.reload();
  await p.getByText(title, { exact: true }).first().click();
  await p.getByRole("heading", { name: title, exact: true }).waitFor();
  await result(step, "PASS");
  step = "Second location blocked and four Business upgrades";
  await p.goto(base + "/app/locations");
  await save(title + " second");
  for (const label of ["Business Starter", "Business", "Business Pro", "Business Scale"])
    await p.getByRole("dialog").getByText(label, { exact: true }).waitFor();
  await result(step, "PASS");
} catch {
  await result(step, "FAIL");
  process.exitCode = 1;
} finally {
  await browser.close();
}
