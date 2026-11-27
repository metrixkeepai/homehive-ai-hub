// Protected environment credentials belong to the named customer QA fixtures.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasExactGbp } from "../../src/lib/speech-facts.ts";

const target = process.env.APP_ENV;
assert.ok(["staging", "production"].includes(target));
const role = process.env.QA_ROLE;
assert.ok(["individual", "business"].includes(role));
const prod = target === "production";
const origin = prod
  ? "https://matrixkeep.com"
  : "https://matrixkeep-staging-web-893477687403.europe-west2.run.app";
const email = prod
  ? role === "business"
    ? "sain.sabu@talksandtalks.ai"
    : "sain.sabu41@gmail.com"
  : "zaineluvathingal+matrixkeep-public-" + role + "@gmail.com";
const password = process.env.QA_PASSWORD;
assert.ok(password, "QA sign-in credential unavailable");
const dir = mkdtempSync(join(tmpdir(), "matrixkeep-qa-"));
const ref = "MK-" + process.env.GITHUB_RUN_ID + "-" + process.env.GITHUB_RUN_ATTEMPT + "-" + role;
const results = [];
const report = (mode, status) => {
  results.push({ mode, status });
  console.log(mode, status);
  if (status !== "PASS" && status !== "EXPECTED ENTITLEMENT BLOCK") process.exitCode = 1;
};
let browser;
try {
  execFileSync("python3", ["scripts/ai-benchmark-fixtures.py", dir, ref]);
  if (process.env.QA_HUMAN_WAV)
    writeFileSync(join(dir, "human.wav"), Buffer.from(process.env.QA_HUMAN_WAV, "base64"), {
      mode: 0o600,
    });
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(origin + "/auth");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL((url) => url.origin === origin && url.pathname.startsWith("/app"));
  await page.goto(origin + "/app/profile");
  await page.waitForFunction(
    (expected) =>
      Array.from(document.querySelectorAll("input[disabled]")).some(
        (input) => input.value === expected,
      ),
    email,
  );
  const state = await page.context().storageState();
  for (const [mode, label] of Object.entries({
    receipt: "Scan receipt",
    en: "Speak",
    ml: "Speak",
    photo: "Take photo",
    document: "Upload document",
    room: "Scan room",
    email: "Import email",
  })) {
    const speech = mode === "en" || mode === "ml";
    if (mode === "ml" && !process.env.QA_HUMAN_WAV) {
      report(mode, "HUMAN AUDIO UNAVAILABLE");
      continue;
    }
    const file = join(dir, mode === "ml" ? "human.wav" : "en.wav");
    const client = await chromium.launch({
      args: speech
        ? [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            "--use-file-for-fake-audio-capture=" + file + "%noloop",
          ]
        : [],
    });
    let phase = "allowance";
    try {
      const p = await client.newPage({
        storageState: state,
        permissions: speech ? ["microphone"] : [],
        timezoneId: "Europe/London",
      });
      await p.goto(origin + "/app/billing");
      const usage = await p.getByText(/^Account AI captures/).innerText();
      const quota = usage.match(/(\d+) \/ (\d+|Unlimited)/);
      assert.ok(quota);
      const remaining = quota[2] === "Unlimited" ? Infinity : Number(quota[2]) - Number(quota[1]);
      await p.goto(origin + "/app");
      await p
        .getByRole("button", { name: "Add anything", exact: true })
        .filter({ visible: true })
        .first()
        .click();
      await p.getByRole("button", { name: label, exact: true }).click();
      if (
        ["room", "email"].includes(mode) &&
        (await p.getByText(/^Not included in your Free plan$/i).isVisible())
      ) {
        report(mode, "EXPECTED ENTITLEMENT BLOCK");
        continue;
      }
      if (remaining < (speech ? 2 : 1) + (prod ? 1 : 0)) {
        report(mode, "INSUFFICIENT QA ALLOWANCE");
        continue;
      }
      phase = "capture";
      if (speech) {
        assert.equal(await p.getByRole("combobox", { name: /language/i }).count(), 0);
        await p.getByText("Detect automatically", { exact: true }).waitFor();
        await p.getByRole("button", { name: "Tap and speak" }).click();
        const stop = p.getByRole("button", { name: /Listening.*finish/ });
        await stop.waitFor();
        await new Promise((resolve) => setTimeout(resolve, statSync(file).size / 32 + 400));
        await stop.click();
        await p.waitForFunction(() => document.querySelector("textarea")?.value, null, {
          timeout: 105000,
        });
        await p.getByText("Original transcript", { exact: true }).click();
        const original = await p.locator("details[open] p").innerText();
        assert.ok(mode === "ml" ? /[\u0D00-\u0D7F]/u.test(original) : original.trim().length);
        const english = await p.locator("textarea").inputValue();
        assert.ok(hasExactGbp(english, mode === "ml" ? 599 : 65));
        if (mode === "ml")
          assert.ok(
            [
              /Dyson\s*V15/i,
              /vacuum/i,
              /currys/i,
              /today/i,
              /(?:two|2)[ -]years?|24 months/i,
            ].every((x) => x.test(english)),
          );
      } else if (mode === "email") {
        await p
          .locator("textarea")
          .fill(
            "From: Elm Appliances\nSubject: Your receipt " +
              ref +
              "\nOne Bosch TWK7203 kettle for GBP 65.00 on 18 March 2026.",
          );
      } else {
        const source = {
          room: "src/assets/auth-home.jpg",
          photo: "src/assets/passport-tv.jpg",
          document: join(dir, "receipt.pdf"),
          receipt: join(dir, "clear-receipt.jpg"),
        };
        await p.locator("input[type=file]").setInputFiles(source[mode]);
      }
      phase = "review";
      await p.getByRole("button", { name: "Let the AI read it" }).click();
      const save = p.getByRole("button", { name: /Save \d+ record/ });
      await save.waitFor({ timeout: 100000 });
      const review = await p
        .locator("input,dd,dt")
        .evaluateAll((els) => els.map((e) => e.value ?? e.textContent).join(" "));
      if (["receipt", "document"].includes(mode))
        assert.ok(
          [new RegExp(ref, "i"), /elm appliances/i, /TWK7203/i, /2026-03-18/, /65/].every((x) =>
            x.test(review),
          ),
        );
      if (mode === "photo") assert.match(review, /television|\bTV\b/i);
      if (mode === "room") assert.match(review, /sofa|chair|table/i);
      if (mode === "ml")
        assert.ok(
          /Dyson\s*V15/i.test(review) && /Currys/i.test(review) && hasExactGbp(review, 599),
        );
      phase = "save";
      p.once("dialog", async (d) => {
        if (d.type() === "confirm" && /^This file was already uploaded as /.test(d.message()))
          await d.accept();
        else await d.dismiss();
      });
      await save.click();
      await p.getByText(/^Saved to /).waitFor();
      const links = await p
        .locator("div.fixed")
        .filter({ has: p.getByRole("button", { name: "Add more", exact: true }) })
        .last()
        .locator('a[href^="/app/"]')
        .evaluateAll((els) =>
          els.map((e) => [e.getAttribute("href"), e.querySelector("span")?.textContent]),
        );
      assert.ok(links.length);
      if (mode === "receipt")
        for (const route of ["assets", "documents", "warranties"])
          assert.ok(links.some(([url]) => url.startsWith("/app/" + route + "/")));
      phase = "reopen";
      for (const [url, title] of links) {
        await p.goto(origin + url);
        await p.getByText(title, { exact: true }).first().waitFor();
        if (mode === "ml") {
          const saved = await p.locator("main").innerText();
          const date = await p.evaluate(() =>
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Europe/London",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date()),
          );
          if (url.startsWith("/app/assets/"))
            assert.ok(
              /Dyson\s*V15/i.test(saved) &&
                /Currys/i.test(saved) &&
                hasExactGbp(saved, 599) &&
                saved.includes(date),
            );
          if (url.startsWith("/app/warranties/")) {
            const expiry = new Date(date + "T12:00:00Z");
            expiry.setUTCFullYear(expiry.getUTCFullYear() + 2);
            assert.ok(saved.includes(expiry.toISOString().slice(0, 10)));
          }
        }
      }
      if (mode === "ml")
        for (const route of ["assets", "warranties"])
          assert.ok(links.some(([url]) => url.startsWith("/app/" + route + "/")));
      report(mode, "PASS");
    } catch {
      report(mode, phase.toUpperCase() + " FAILED");
    } finally {
      await client.close();
    }
  }
} finally {
  await browser?.close();
  rmSync(dir, { recursive: true, force: true });
  writeFileSync(
    "browser-" + target + "-" + role + ".json",
    JSON.stringify({ target, role, results }),
  );
}
