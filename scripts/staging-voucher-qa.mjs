import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { createExecutionIdentity } from "./staging-qa-identity.mjs";

const e = process.env;
const base = "https://matrixkeep-staging-web-893477687403.europe-west2.run.app";
assert.equal(e.APP_ENV, "staging");
assert.equal(new URL(e.SUPABASE_URL).hostname, "cdfpupivjjamhvmfcvry.supabase.co");
assert.match(e.STRIPE_SECRET_KEY, /^(rk|sk)_test_/);
const db = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const stripe = new Stripe(e.STRIPE_SECRET_KEY);
const browser = await chromium.launch();
let step = "Super Admin login";
try {
  const admin = await browser.newPage();
  await admin.goto(base + "/super-admin/login");
  await admin.getByLabel("Email", { exact: true }).fill(e.SUPER_ADMIN_EMAIL);
  await admin.getByLabel("Password", { exact: true }).fill(e.SUPER_ADMIN_PASSWORD);
  await admin.locator("form button[type=submit]").click();
  await admin.waitForURL(/\/super-admin\/?$/);
  await admin.goto(base + "/super-admin/plans");
  await admin.getByText("Business Free", { exact: true }).first().waitFor();
  for (const [audience, plan, name, benefit, value, original, total] of [
    ["individual", "family", "Family", "discount_percent", 90, 1499, 150],
    ["business", "business", "Business", "discount_fixed", 10, 2900, 1900],
  ]) {
    step = audience + " fixture";
    const { email } = createExecutionIdentity(e.QA_RUN, e.QA_ATTEMPT);
    const password = randomUUID() + randomUUID();
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { account_type: audience, full_name: "Staging billing QA" },
    });
    if (error) throw Error(step);
    const code = "QA" + randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
    step = audience + " Super Admin voucher";
    await admin.goto(base + "/super-admin/vouchers");
    await admin.getByRole("button", { name: "Create voucher", exact: true }).click();
    await admin.getByLabel("Name", { exact: true }).fill("Staging billing acceptance");
    await admin.getByLabel("Code", { exact: true }).fill(code);
    await admin.getByLabel("Benefit", { exact: true }).selectOption(benefit);
    await admin.getByLabel("Plan", { exact: true }).selectOption(plan);
    await admin
      .getByLabel(benefit === "discount_fixed" ? "Amount off (£)" : "Discount %", { exact: true })
      .fill(String(value));
    await admin.getByPlaceholder("customer@example.com").fill(email);
    await admin.getByRole("button", { name: "Review", exact: true }).click();
    await admin.getByRole("button", { name: "Create", exact: true }).click();
    await admin.getByText(code, { exact: true }).first().waitFor();
    const page = await browser.newPage();
    step = audience + " login";
    await page.goto(base + "/auth");
    await page.locator("input[type=email]").fill(email);
    await page.locator("input[type=password]").fill(password);
    await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/app(?:\/|$)/);
    if (audience === "business") {
      step = "Business Free location save and reopen";
      await page.goto(base + "/app/locations");
      const location = "QA branch " + e.QA_RUN;
      const save = async (n) => {
        await page.getByRole("button", { name: "Add location", exact: true }).click();
        await page.getByLabel("Location name").fill(n);
        await page.getByRole("button", { name: "Save location" }).click();
      };
      await save(location);
      await page.getByText(location, { exact: true }).first().waitFor();
      await page.reload();
      await page.getByText(location, { exact: true }).first().click();
      await page.getByRole("heading", { name: location, exact: true }).waitFor();
      await page.goto(base + "/app/locations");
      step = "second location blocked with eligible upgrades";
      await save(location + " second");
      for (const label of ["Business Starter", "Business", "Business Pro", "Business Scale"])
        await page.getByRole("dialog").getByText(label, { exact: true }).waitFor();
    }
    step = audience + " voucher quote";
    await page.goto(base + "/app/plans");
    await page
      .getByRole("heading", {
        name: audience === "business" ? "Business Free" : "Free",
        exact: true,
      })
      .first()
      .waitFor();
    await page.getByPlaceholder("Voucher code").fill(code);
    await page.getByRole("button", { name: "Redeem", exact: true }).click();
    await page
      .getByText(code + " applied ·", { exact: false })
      .first()
      .waitFor();
    await page.getByRole("button", { name: "Choose " + name, exact: true }).click();
    step = audience + " embedded Stripe amount";
    await page
      .frameLocator("#checkout iframe")
      .first()
      .getByText(
        new RegExp("£\\s*" + (total / 100).toFixed(2).replace(/\.00$/, "").replace(".", "\\.")),
      )
      .first()
      .waitFor({ timeout: 45000 });
    const customer = await db
      .from("billing_customers")
      .select("customer_id")
      .eq("user_id", data.user.id)
      .eq("environment", "sandbox")
      .single();
    assert.ok(customer.data?.customer_id);
    const [session] = (
      await stripe.checkout.sessions.list({
        customer: customer.data.customer_id,
        status: "open",
        limit: 1,
      })
    ).data;
    assert.equal(session.livemode, false);
    assert.equal(session.currency, "gbp");
    assert.equal(session.amount_subtotal, original);
    assert.equal(session.total_details.amount_discount, original - total);
    assert.equal(session.amount_total, total);
    await stripe.checkout.sessions.expire(session.id);
    console.log(
      audience,
      "Stripe sandbox confirmed",
      original,
      "minus",
      original - total,
      "equals",
      total,
      "pence",
    );
    await page.close();
  }
} catch {
  console.error("Staging acceptance failed at", step);
  process.exitCode = 1;
} finally {
  await browser.close();
}
