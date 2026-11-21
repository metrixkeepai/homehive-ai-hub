// Runs only in the dedicated staging QA job. Never persist credentials, page contents or session URLs.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const env = process.env;
const base = "https://matrixkeep-staging-web-893477687403.europe-west2.run.app";
if (
  env.APP_ENV !== "staging" ||
  env.SUPABASE_URL?.replace(/\/$/, "") !== "https://cdfpupivjjamhvmfcvry.supabase.co" ||
  !/^\d+$/.test(env.QA_RUN)
)
  throw Error("Unexpected QA target");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function record(check_name, outcome) {
  const { error } = await db
    .from("release_qa_checks")
    .upsert({ run_id: env.QA_RUN, check_name, outcome });
  if (error) throw Error("Unable to record check");
  console.log(check_name, outcome);
  if (outcome !== "PASS") process.exitCode = 1;
}
async function check(name, fn) {
  try {
    await fn();
    await record(name, "PASS");
    return true;
  } catch (e) {
    await record(
      name,
      e?.message === "Admin sign-in rejected"
        ? "SIGN_IN_REJECTED"
        : e?.name === "TimeoutError"
          ? "TIMEOUT"
          : "FAIL",
    );
    return false;
  }
}
const identity = await check("Stripe runtime account", async () => {
  if (!/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY)) throw Error();
  const r = await fetch("https://api.stripe.com/v1/account", {
    headers: { authorization: "Bearer " + env.STRIPE_SECRET_KEY },
  });
  if (r.ok) {
    if ((await r.json()).id !== "acct_1USCeXCvVNDP3ZsF") throw Error();
    return;
  }
  // Restricted checkout keys may only read billing objects. This immutable price was
  // independently read from the owner's dedicated sandbox when it was provisioned.
  if (r.status !== 403) throw Error();
  const anchor = "price_1Ue1inCvVNDP3ZsFx4GFD15K";
  const price = await fetch("https://api.stripe.com/v1/prices/" + anchor, {
    headers: { authorization: "Bearer " + env.STRIPE_SECRET_KEY },
  });
  if (!price.ok) throw Error();
  const p = await price.json();
  if (p.id !== anchor || p.livemode !== false || p.product !== "matrixkeep_plus") throw Error();
});
for (const model of ["gpt-6-luna", "gpt-6.1-sol", "gpt-transcribe", "gpt-realtime-2.1"]) {
  const r = await fetch("https://api.openai.com/v1/models/" + model, {
    headers: { authorization: "Bearer " + env.OPENAI_API_KEY },
  });
  await record(
    "OpenAI model " + model,
    r.ok && (await r.json()).id === model ? "PASS" : "HTTP " + r.status,
  );
}
const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
try {
  const admin = await browser.newPage();
  const adminOk = await check("Super Admin login", async () => {
    await admin.goto(base + "/super-admin/login");
    await admin.getByLabel("Email", { exact: true }).fill(env.SUPER_ADMIN_EMAIL);
    await admin.getByLabel("Password", { exact: true }).fill(env.SUPER_ADMIN_PASSWORD);
    await admin.locator("form button[type=submit]").click();
    await Promise.race([
      admin.waitForURL((url) => /^\/super-admin\/?$/.test(url.pathname)),
      admin
        .getByRole("alert")
        .filter({ hasText: /sign in failed|doesn.t have|couldn.t verify/i })
        .waitFor()
        .then(() => {
          throw Error("Admin sign-in rejected");
        }),
    ]);
  });
  if (adminOk) {
    for (const route of [
      "subscribers",
      "subscriptions",
      "plans",
      "plans/home",
      "vouchers",
      "revenue",
      "payments",
      "billing",
      "ai",
      "infrastructure",
      "api",
      "health",
      "integrations",
      "flags",
      "audit",
      "reports",
    ]) {
      await check("Admin route " + route, async () => {
        await admin.goto(base + "/super-admin/" + route);
        await admin.locator("main h1").first().waitFor({ timeout: 5000 });
        if (
          admin.url() !== base + "/super-admin/" + route ||
          (await admin
            .getByText(/change your password|couldn.t load|something went wrong/i)
            .count())
        )
          throw Error();
      });
    }
  }
  const password = randomUUID() + randomUUID();
  const email = "metrixkeepai+qa-" + env.QA_RUN + "@gmail.com";
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { account_type: "individual", full_name: "MatrixKeep staging QA" },
  });
  if (error) throw Error("QA account creation failed");
  const page = await browser.newPage();
  page.setDefaultTimeout(12000);
  const login = await check("Individual browser login", async () => {
    await page.goto(base + "/auth");
    await page.locator("input[type=email]").fill(email);
    await page.locator("input[type=password]").fill(password);
    await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/app(?:\/|$)/);
  });
  if (login) {
    for (const w of [320, 375, 390, 430, 768, 1024]) {
      await check("Plans viewport " + w, async () => {
        await page.setViewportSize({ width: w, height: 850 });
        await page.goto(base + "/app/plans");
        const btn = page.getByRole("button", { name: "Choose Home+", exact: true });
        await btn.waitFor();
        await btn.scrollIntoViewIfNeeded();
        if (
          !(await btn.isEnabled()) ||
          (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2))
        )
          throw Error();
      });
    }
    if (identity)
      await check("Home+ sandbox browser purchase", async () => {
        await page.getByRole("button", { name: "Choose Home+", exact: true }).click();
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
            const card = frame.getByRole("button", { name: "Pay with card", exact: true });
            if (!cardChosen && (await card.isVisible())) {
              await card.click();
              cardChosen = true;
            }
          }
          if (!form) await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        await record(
          "Stripe embedded card fields",
          form ? "PASS" : stripeFrames().length ? "FIELDS_UNAVAILABLE" : "NO_PROVIDER_FRAME",
        );
        if (!form) throw Error();
        await form.locator(controls.number).first().fill("4242424242424242");
        await form.locator(controls.expiry).first().fill("1230");
        await form.locator(controls.cvc).first().fill("123");
        const country = form.locator('select[name="billingCountry"]');
        if (await country.isVisible()) await country.selectOption("GB");
        const postcode = form.locator('[name="billingPostalCode"]');
        const needsZip =
          (await postcode.isVisible()) &&
          /zip/i.test((await postcode.getAttribute("placeholder")) ?? "");
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
        await record("Stripe sandbox payment submitted", submitted ? "PASS" : "SUBMIT_UNAVAILABLE");
        if (!submitted) throw Error();
        const user = created.user;
        if (!user) throw Error();
        for (let attempt = 0; attempt < 12; attempt++) {
          const p = await db.from("profiles").select("plan,plan_source").eq("id", user.id).single();
          if (p.data?.plan === "plus" && p.data.plan_source === "stripe") return;
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
        throw Error();
      });
  }
} finally {
  await browser.close();
}
