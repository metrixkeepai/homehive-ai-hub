import { checkPlanPropagation } from "./staging-plan-propagation.mjs";
// Runs only in the dedicated staging QA job. Never persist credentials, page contents or session URLs.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createExecutionIdentity } from "./staging-qa-identity.mjs";
const env = process.env;
const base = "https://matrixkeep-staging-web-893477687403.europe-west2.run.app";
if (
  env.APP_ENV !== "staging" ||
  env.SUPABASE_URL?.replace(/\/$/, "") !== "https://cdfpupivjjamhvmfcvry.supabase.co" ||
  !/^\d+$/.test(env.QA_RUN) ||
  !/^\d+$/.test(env.QA_ATTEMPT)
)
  throw Error("Unexpected QA target");
const { executionId, email } = createExecutionIdentity(env.QA_RUN, env.QA_ATTEMPT);
console.log("Certification execution", executionId, "revision", env.QA_REVISION);
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function record(check_name, outcome) {
  const { error } = await db
    .from("release_qa_checks")
    .insert({ run_id: executionId, check_name, outcome });
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
      e?.message?.startsWith("ADMIN_")
        ? e.message
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
if (identity) {
  for (const plan of [
    "home",
    "plus",
    "family",
    "business_starter",
    "business",
    "business_pro",
    "business_scale",
  ]) {
    for (const interval of ["monthly", "yearly"]) {
      await check("Stripe catalogue " + plan + " " + interval, async () => {
        const url = new URL("https://api.stripe.com/v1/prices");
        url.searchParams.set("lookup_keys[]", plan + "_" + interval);
        url.searchParams.set("active", "true");
        const response = await fetch(url, {
          headers: { authorization: "Bearer " + env.STRIPE_SECRET_KEY },
        });
        if (!response.ok) throw Error();
        const { data } = await response.json();
        if (
          data.length !== 1 ||
          data[0].livemode ||
          data[0].currency !== "gbp" ||
          data[0].product !== "matrixkeep_" + plan ||
          !(data[0].unit_amount > 0) ||
          data[0].recurring?.interval !== (interval === "monthly" ? "month" : "year")
        )
          throw Error();
      });
    }
  }
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
        .then(async () => {
          const alert = await admin.getByRole("alert").innerText();
          throw Error(
            /sign in failed/i.test(alert)
              ? "ADMIN_CREDENTIAL_REJECTED"
              : /have Super Admin/i.test(alert)
                ? "ADMIN_ROLE_DENIED"
                : "ADMIN_ACCESS_CHECK_FAILED",
          );
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
            .getByText(
              /set your own password|change your password|couldn.t load|something went wrong/i,
            )
            .count())
        )
          throw Error();
      });
    }
  }
  const password = randomUUID() + randomUUID();
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
  if (adminOk && login) {
    await check("Approved capture allowance on pricing, plans, billing and runtime", async () => {
      await checkPlanPropagation({
        admin,
        page,
        db,
        base,
        key: "free",
        userId: created.user.id,
        executionId,
      });
    });
  }
  if (login) {
    for (const section of [
      "my-home",
      "rooms",
      "assets",
      "vehicles",
      "documents",
      "warranties",
      "renewals",
      "insurance",
      "maintenance",
      "tasks",
      "calendar",
      "services",
      "family",
      "integrations",
      "billing",
    ]) {
      await check("Individual page " + section, async () => {
        await page.goto(base + "/app/" + section);
        const heading = page.locator("h1").first();
        await heading.waitFor();
        if (
          new URL(page.url()).pathname.replace(/\/$/, "") !== "/app/" + section ||
          /doesn.t exist|not found|welcome back|error/i.test(await heading.innerText()) ||
          (await page.getByText(/This capability is not available in this release/).count())
        )
          throw Error();
      });
    }
    await check("Service provider save and reload", async () => {
      await page.goto(base + "/app/services");
      await page.getByRole("button", { name: "Add provider", exact: true }).click();
      await page.getByLabel("Business name").fill("Staging QA provider");
      await page.getByLabel("Trade", { exact: true }).fill("Maintenance");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByText("Staging QA provider", { exact: true }).first().waitFor();
      await page.reload();
      await page.getByText("Staging QA provider", { exact: true }).first().waitFor();
    });
    await check("Business workspace create and switch", async () => {
      await page.getByRole("button", { name: "Personal", exact: true }).click();
      await page.getByRole("menuitem", { name: "New workspace" }).click();
      await page.getByPlaceholder("e.g. Smile Dental Clinic").fill("QA business workspace");
      await page.getByRole("button", { name: "Create and switch" }).click();
      const business = page.getByRole("button", { name: "QA business workspace", exact: true });
      await business.waitFor();
      await page.goto(base + "/app/locations");
      await page.locator("h1").first().waitFor();
      await business.click();
      await page.getByRole("menuitem", { name: /Personal.*individual/i }).click();
      await page.goto(base + "/app/services");
      await page.getByText("Staging QA provider", { exact: true }).first().waitFor();
    });
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
    if (identity && env.QA_REPEAT_HOME_PLUS === "true")
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
            // Stripe's accessible accordion button can have a zero-sized box while
            // its visible Card label is covered by the row's clickable overlay.
            const label = frame
              .getByText("Card", { exact: true })
              .filter({ visible: true })
              .first();
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
    await check("User sign out", async () => {
      await page.goto(base + "/app");
      await page.getByRole("button", { name: "Account menu" }).click();
      await page.getByRole("menuitem", { name: "Sign out" }).click();
      await page.waitForURL(base + "/auth");
      await page.goto(base + "/app");
      await page.waitForURL(/\/auth(?:\?|$)/);
    });
  }
} finally {
  await browser.close();
}
