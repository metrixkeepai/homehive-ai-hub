// Production acceptance uses audience- and email-bound QA offers. Never submit a payment.
import { chromium } from "playwright";
import assert from "node:assert/strict";
const e = process.env;
const base = "https://matrixkeep.com";
assert.match(e.RELEASE_SHA, /^[a-f0-9]{40}$/);
const browser = await chromium.launch();
let step = "health";
try {
  for (const path of ["/health/live", "/health/ready"]) {
    const r = await fetch(base + path);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).status, "ok");
  }
  for (const [role, email, password, plan, total] of [
    ["I", "sain.sabu41@gmail.com", e.INDIVIDUAL_PASSWORD, "Family", "1.50"],
    ["B", "sain.sabu@talksandtalks.ai", e.BUSINESS_PASSWORD, "Business", "19"],
  ]) {
    step = role + " customer login";
    assert.ok(password);
    const page = await browser.newPage();
    await page.goto(base + "/auth");
    await page.locator("form[data-interactive=true]").waitFor();
    await page.locator("input[type=email]").fill(email);
    await page.locator("input[type=password]").fill(password);
    await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/app(?:\/|$)/);
    if (role === "B") {
      step = "Business Free billing";
      await page.goto(base + "/app/billing");
      await page.getByText("Business Free", { exact: true }).first().waitFor();
      const location = "Internal release QA " + e.RELEASE_SHA.slice(0, 8);
      step = "Business Free location save and reopen";
      await page.goto(base + "/app/locations");
      const add = async (name) => {
        await page.getByRole("button", { name: "Add location", exact: true }).click();
        await page.getByLabel("Location name").fill(name);
        await page.getByRole("button", { name: "Save location", exact: true }).click();
      };
      await page.getByRole("button", { name: "Add location", exact: true }).waitFor();
      if (!(await page.getByText(location, { exact: true }).isVisible())) await add(location);
      await page.getByText(location, { exact: true }).first().waitFor();
      await page.reload();
      await page.getByText(location, { exact: true }).first().click();
      await page.getByRole("heading", { name: location, exact: true }).waitFor();
      await page.goto(base + "/app/locations");
      await add(location + " second");
      step = "second location blocked and four eligible upgrades";
      for (const label of ["Business Starter", "Business", "Business Pro", "Business Scale"])
        await page.getByRole("dialog").getByText(label, { exact: true }).waitFor();
    }
    step = role + " Plans quote";
    await page.goto(base + "/app/plans");
    const code = "VQA" + e.RELEASE_SHA.slice(0, 10).toUpperCase() + role;
    await page.getByPlaceholder("Voucher code").fill(code);
    await page.getByRole("button", { name: "Redeem", exact: true }).click();
    await page
      .getByText(code + " applied ·")
      .first()
      .waitFor();
    await page.getByRole("button", { name: "Choose " + plan, exact: true }).click();
    step = role + " Stripe hosted amount";
    if (role === "I") {
      const link = page.getByRole("link", { name: "Review your subscription in Stripe" });
      await link.waitFor();
      const url = new URL(await link.getAttribute("href"));
      assert.equal(url.protocol, "https:");
      assert.equal(url.hostname, "billing.stripe.com");
      await link.click();
    }
    let seen = false;
    const amount = new RegExp("£\\s*" + total.replace(".", "\\.") + "(?:\\.00)?(?![0-9.])");
    for (let n = 0; n < 60 && !seen; n++) {
      for (const f of page.frames()) {
        let host;
        try {
          host = new URL(f.url()).hostname;
        } catch {
          continue;
        }
        if (!host.endsWith(".stripe.com")) continue;
        const body = await f
          .locator("body")
          .innerText({ timeout: 2000 })
          .catch(() => "");
        if (amount.test(body) && body.includes(plan)) {
          seen = true;
          break;
        }
      }
      if (!seen) await new Promise((r) => setTimeout(r, 1000));
    }
    assert.ok(seen);
    console.log(plan, "verified on Stripe", total, "GBP; stopped before confirmation");
    await page.close();
  }
} catch {
  console.error("Production browser acceptance failed at", step);
  process.exitCode = 1;
} finally {
  await browser.close();
}
