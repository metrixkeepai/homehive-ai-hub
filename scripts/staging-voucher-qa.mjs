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
async function payInSandbox(page) {
  const controls = {
    number: 'input[autocomplete="cc-number"],input[name="cardNumber"],input[name="number"]',
    expiry: 'input[autocomplete="cc-exp"],input[name="cardExpiry"],input[name="expiry"]',
    cvc: 'input[autocomplete="cc-csc"],input[name="cardCvc"],input[name="cvc"]',
  };
  const stripeFrames = () =>
    page.frames().filter((f) => {
      try {
        return new URL(f.url()).hostname.endsWith(".stripe.com");
      } catch {
        return false;
      }
    });
  let form;
  let cardChosen = false;
  for (let i = 0; i < 30 && !form; i++) {
    for (const frame of stripeFrames()) {
      if (await frame.locator(controls.number).first().isVisible()) {
        form = frame;
        break;
      }
      // Stripe's accessible accordion button can have a zero-sized box while
      // its visible Card label is covered by the row's clickable overlay.
      const label = frame.getByText("Card", { exact: true }).filter({ visible: true }).first();
      if (!cardChosen && (await label.isVisible())) {
        await label.scrollIntoViewIfNeeded();
        const box = await label.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          cardChosen = true;
        }
      }
    }
    if (!form) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!form) throw Error();
  await form.locator(controls.number).first().fill("4242424242424242");
  await form.locator(controls.expiry).first().fill("1230");
  await form.locator(controls.cvc).first().fill("123");
  const country = form.locator('select[name="billingCountry"]');
  if (await country.isVisible()) await country.selectOption("GB");
  const postcode = form.locator('[name="billingPostalCode"]');
  const needsZip =
    (await postcode.isVisible()) && /zip/i.test((await postcode.getAttribute("placeholder")) ?? "");
  for (const [name, value] of [
    ["billingName", "MatrixKeep QA"],
    ["billingPostalCode", needsZip ? "10001" : "MK9 1AA"],
  ]) {
    const el = form.locator('[name="' + name + '"]');
    if (await el.isVisible()) await el.fill(value);
  }
  let submitted = false;
  for (const frame of stripeFrames()) {
    const submit = frame
      .getByRole("button", { name: /subscribe|pay now|start subscription/i })
      .last();
    if ((await submit.isVisible()) && (await submit.isEnabled())) {
      await submit.click();
      submitted = true;
      break;
    }
  }

  if (!submitted) throw Error();
}
let step = "Super Admin login";
try {
  const admin = await browser.newPage();
  await admin.goto(base + "/super-admin/login");
  await admin.locator("form[data-interactive=true]").waitFor();
  await admin.getByLabel("Email", { exact: true }).fill(e.SUPER_ADMIN_EMAIL);
  await admin.getByLabel("Password", { exact: true }).fill(e.SUPER_ADMIN_PASSWORD);
  await admin.locator("form button[type=submit]").click();
  await admin.waitForURL(/\/super-admin\/?$/);
  await admin.goto(base + "/super-admin/plans");
  await admin.getByText("Business Free", { exact: true }).first().waitFor();
  for (const [audience, plan, name, benefit, value, original, total] of [
    ["individual", "family", "Family", "discount_percent", 90, 1499, 150],
    ["business", "business", "Business", "discount_fixed", 10, 2900, 1900],
    ["individual", "family", "Family", "discount_fixed", 10, 1499, 499],
    ["business", "business", "Business", "discount_percent", 90, 2900, 290],
    ["individual", "home", "Home", "free_period", 1, 499, 0],
    ["business", "business", "Business", "free_period", 1, 2900, 0],
    ["individual", "family", "Family", "plan", 1, 1499, 0],
    ["business", "business", "Business", "plan", 1, 2900, 0],
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
    step = audience + " open form";
    await admin.getByRole("button", { name: "Create voucher", exact: true }).click();
    step = audience + " enter voucher";
    await admin.getByPlaceholder("Spring launch offer").fill("Staging billing acceptance");
    await admin.getByPlaceholder("SPRING2027").fill(code);
    await admin
      .locator("select")
      .filter({ has: admin.locator('option[value="discount_percent"]') })
      .selectOption(benefit);
    await admin
      .locator("select")
      .filter({ has: admin.locator('option[value="family"]') })
      .selectOption(plan);
    if (benefit.startsWith("discount"))
      await admin
        .getByLabel(benefit === "discount_fixed" ? "Amount off (£)" : "Discount %", { exact: true })
        .fill(String(value));
    if (benefit === "free_period" || benefit === "plan") {
      await admin
        .locator("select")
        .filter({ has: admin.locator('option[value="months"]') })
        .selectOption("months");
      await admin.getByLabel("Months", { exact: true }).fill("1");
    }
    await admin.getByPlaceholder("customer@example.com").fill(email);
    step = audience + " review voucher";
    await admin.getByRole("button", { name: "Review", exact: true }).click();
    step = audience + " create voucher";
    await admin.getByRole("button", { name: "Create", exact: true }).click();
    step = audience + " confirm creation";
    await admin.getByText(code, { exact: true }).first().waitFor();
    const page = await browser.newPage();
    step = audience + " login";
    await page.goto(base + "/auth");
    await page.locator("form[data-interactive=true]").waitFor();
    await page.locator("input[type=email]").fill(email);
    await page.locator("input[type=password]").fill(password);
    await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/app(?:\/|$)/);
    if (audience === "business" && benefit === "discount_fixed") {
      await page.goto(base + "/app/billing");
      await page.getByText("Business Free", { exact: true }).first().waitFor();
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
    if (benefit === "plan") {
      await page
        .getByText("Voucher applied — " + name, { exact: true })
        .first()
        .waitFor();
      const profile = await db
        .from("profiles")
        .select("plan,plan_source,voucher_ends_at")
        .eq("id", data.user.id)
        .single();
      assert.equal(profile.data?.plan, plan);
      assert.equal(profile.data.plan_source, "voucher:" + code);
      assert.ok(Date.parse(profile.data.voucher_ends_at) > Date.now());
      console.log(audience, "plan grant PASS");
      await page.close();
      continue;
    }
    await page
      .getByText(code + " applied ·", { exact: false })
      .first()
      .waitFor();
    await page.getByRole("button", { name: "Choose " + name, exact: true }).click();
    step = audience + " embedded Stripe amount";
    const displayedAmount = new RegExp(
      "£\\s*" + (total / 100).toFixed(2).replace(/\.00$/, "").replace(".", "\\.") + "(?![0-9])",
    );
    let shown = false;
    for (let i = 0; i < 45 && !shown; i++) {
      for (const frame of page.frames()) {
        let host;
        try {
          host = new URL(frame.url()).hostname;
        } catch {
          continue;
        }
        if (!host.endsWith(".stripe.com")) continue;
        const body = await frame
          .locator("body")
          .innerText({ timeout: 1200 })
          .catch(() => "");
        if (displayedAmount.test(body)) {
          shown = true;
          break;
        }
      }
      if (!shown) await new Promise((r) => setTimeout(r, 1000));
    }
    assert.ok(shown);
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
    if (benefit !== "free_period") assert.equal(session.amount_subtotal, original);
    if (benefit !== "free_period")
      assert.equal(session.total_details.amount_discount, original - total);
    assert.equal(session.amount_total, total);
    if (
      benefit === "free_period" ||
      (benefit === "discount_percent" && audience === "individual")
    ) {
      step = audience + " " + benefit + " sandbox payment and webhook settlement";
      await payInSandbox(page);
      let completed = false;
      for (let n = 0; n < 30; n++) {
        const row = await db
          .from("voucher_redemptions")
          .select("outcome,subscription_id")
          .eq("code", code)
          .eq("checkout_session", session.id)
          .maybeSingle();
        if (row.data?.outcome === "final") {
          const subscription = await stripe.subscriptions.retrieve(row.data.subscription_id);
          if (benefit === "free_period") {
            assert.equal(subscription.status, "trialing");
            assert.ok(subscription.trial_end > Date.now() / 1000);
          }
          completed = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      assert.ok(completed);
      if (benefit === "free_period" && audience === "individual") {
        step = "existing Home subscription Family voucher confirmation";
        const next = "QA" + randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
        const offer = await db.from("vouchers").insert({
          code: next,
          plan: "family",
          benefit_type: "discount_percent",
          benefit_value: 90,
          max_uses: 1,
          assigned_email: email,
          audiences: ["individual"],
        });
        assert.ifError(offer.error);
        await page.goto(base + "/app/plans");
        await page.getByPlaceholder("Voucher code").fill(next);
        await page.getByRole("button", { name: "Redeem", exact: true }).click();
        await page
          .getByText(next + " applied ·")
          .first()
          .waitFor();
        await page.getByRole("button", { name: "Choose Family", exact: true }).click();
        const link = page.getByRole("link", { name: "Review your subscription in Stripe" });
        await link.waitFor();
        assert.equal(new URL(await link.getAttribute("href")).hostname, "billing.stripe.com");
        await link.click();
        await page
          .getByText(/£\s*1\.50/)
          .first()
          .waitFor();
        console.log("Existing Home subscription Family voucher confirmed at GBP 1.50");
      }
    } else await stripe.checkout.sessions.expire(session.id);
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
  await db
    .from("release_qa_checks")
    .insert({ run_id: e.QA_RUN + "-voucher-" + e.QA_ATTEMPT, check_name: step, outcome: "FAIL" });
  console.error("Staging acceptance failed at", step);
  process.exitCode = 1;
} finally {
  await browser.close();
}
