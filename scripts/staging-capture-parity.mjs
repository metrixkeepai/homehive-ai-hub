import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { hasExactGbp } from "../src/lib/speech-facts.ts";
import { checkPlanPropagation } from "./staging-plan-propagation.mjs";

const base = "https://matrixkeep-staging-web-893477687403.europe-west2.run.app";
if (
  process.env.APP_ENV !== "staging" ||
  process.env.SUPABASE_URL?.replace(/\/$/, "") !== "https://cdfpupivjjamhvmfcvry.supabase.co"
)
  throw Error("Unexpected QA environment");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const dir = mkdtempSync(join(tmpdir(), "capture-qa-"));
execFileSync("python3", ["scripts/ai-benchmark-fixtures.py", dir]);
const runId = process.env.QA_RUN + "-" + process.env.QA_ATTEMPT + "-capture-parity";
const mark = async (name, result) => {
  const { error } = await db
    .from("release_qa_checks")
    .upsert(
      { run_id: runId, check_name: name, outcome: result },
      { onConflict: "run_id,check_name" },
    );
  if (error) throw Error("QA result storage failed");
  console.log(name, result);
  if (result !== "PASS") process.exitCode = 1;
};
for (const role of ["individual", "business"]) {
  // Fixed, owner-designated staging fixtures only. Each browser follows a single-use
  // Supabase sign-in link. The privileged client is never provided to the page.
  const email = "zaineluvathingal+matrixkeep-public-" + role + "@gmail.com";
  const sessionBrowser = await chromium.launch();
  let state, userId;
  try {
    const { data, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: base + "/auth" },
    });
    if (error || data.user.email !== email || !data.user.email_confirmed_at)
      throw Error("Fixture unavailable");
    userId = data.user.id;
    const page = await sessionBrowser.newPage();
    await page.goto(data.properties.action_link);
    await page
      .getByRole("button", { name: "Add anything", exact: true })
      .filter({ visible: true })
      .first()
      .waitFor();
    await page.goto(base + "/app/profile");
    await page.waitForFunction(
      (expected) =>
        document.querySelector("input[type=email][disabled]")?.value === expected ||
        [...document.querySelectorAll("input[disabled]")].some((input) => input.value === expected),
      email,
    );
    state = await page.context().storageState();
    await mark(role + " browser identity", "PASS");
    if (role === "individual") {
      const admin = await sessionBrowser.newPage();
      try {
        await admin.goto(base + "/super-admin/login");
        await admin.getByLabel("Email", { exact: true }).fill(process.env.SUPER_ADMIN_EMAIL);
        await admin.getByLabel("Password", { exact: true }).fill(process.env.SUPER_ADMIN_PASSWORD);
        await admin.locator("form button[type=submit]").click();
        await admin.waitForURL((url) => url.pathname.replace(/\/$/, "") === "/super-admin");
        await checkPlanPropagation({
          admin,
          page,
          db,
          base,
          key: "family",
          userId: data.user.id,
          executionId: runId,
        });
        await mark("Approved family allowance on pricing, plans, billing and runtime", "PASS");
      } catch (e) {
        await mark(
          "Approved family allowance on pricing, plans, billing and runtime",
          e.safeStage ?? "FAIL",
        );
      }
    }
  } catch {
    await mark(role + " browser identity", "FAIL");
    continue;
  } finally {
    await sessionBrowser.close();
  }
  const runCaptures = async (monthlyLimit) => {
    for (const mode of [
      "receipt",
      "en",
      "ml",
      ...(role === "individual" ? ["fr", "photo", "room", "type", "email"] : []),
    ]) {
      const speech = ["en", "ml", "fr"].includes(mode);
      const wav = join(dir, mode + ".wav");
      const browser = await chromium.launch({
        args: speech
          ? [
              "--use-fake-device-for-media-stream",
              "--use-fake-ui-for-media-stream",
              "--use-file-for-fake-audio-capture=" + wav + "%noloop",
            ]
          : [],
      });
      let step = "OPEN";
      try {
        const page = await browser.newPage({
          storageState: state,
          permissions: speech ? ["microphone"] : [],
        });
        page.setDefaultTimeout(18000);
        await page.goto(base + "/app");
        await page
          .getByRole("button", { name: "Add anything", exact: true })
          .filter({ visible: true })
          .first()
          .click();
        const labels = {
          receipt: "Scan receipt",
          photo: "Take photo",
          room: "Scan room",
          email: "Import email",
        };
        await page.getByRole("button", { name: labels[mode] ?? "Speak", exact: true }).click();
        step = "CAPTURE";
        if (speech) {
          if (mode !== "en") await page.getByLabel("Spoken language").selectOption(mode);
          await page.getByRole("button", { name: "Tap and speak" }).click();
          const stop = page.getByRole("button", { name: /Listening.*finish/ });
          await stop.waitFor();
          await new Promise((r) => setTimeout(r, Math.ceil(statSync(wav).size / 32) + 350));
          await stop.click();
          step = "TRANSCRIPT";
          await page.waitForFunction(() => document.querySelector("textarea")?.value, null, {
            timeout: 105000,
          });
          await page.getByText("Original transcript", { exact: true }).click();
          const original = await page.locator("details[open] p").innerText();
          if (!original.trim() || (mode === "ml" && !/[\u0D00-\u0D7F]/u.test(original)))
            throw Error();
          step = "ENGLISH";
          const draft = await page.locator("textarea").inputValue();
          if (!/kettle/i.test(draft) || !hasExactGbp(draft, 65)) throw Error();
          await page.locator("textarea").fill(draft + " QA reference " + runId + " " + mode);
        } else if (mode === "email" || mode === "type") {
          await page
            .locator("textarea")
            .fill(
              "MatrixKeep QA receipt QA-PAR-658. Elm Appliances. One Bosch kettle TWK7203 for GBP 65.00 on 18 March 2026.",
            );
        } else {
          const file =
            mode === "receipt"
              ? join(dir, "clear-receipt.jpg")
              : mode === "room"
                ? "src/assets/auth-home.jpg"
                : "src/assets/passport-tv.jpg";
          await page.locator("input[type=file]").setInputFiles(file);
          await page.locator("textarea").fill("QA reference " + runId);
        }
        await page.getByRole("button", { name: "Let the AI read it" }).click();
        step = "REVIEW";
        const save = page.getByRole("button", { name: /Save \d+ record/ });
        await save.waitFor({ timeout: 90000 });
        const review = await page
          .locator("input,dd,dt")
          .evaluateAll((els) => els.map((e) => e.value ?? e.textContent).join(" "));
        if (
          mode === "receipt" &&
          ![/MK-508/i, /elm appliances/i, /TWK7203/i, /65/].every((re) => re.test(review))
        )
          throw Error();
        if (speech && (!/kettle/i.test(review) || !hasExactGbp(review, 65))) throw Error();
        if (mode === "photo" && !/television|\bTV\b/i.test(review)) throw Error();
        if (mode === "room" && !/chair|sofa|table/i.test(review)) throw Error();
        step = "SAVE";
        await save.click();
        await page.getByText(/^Saved to /).waitFor();
        const records = await page
          .locator("div.fixed")
          .filter({ has: page.getByRole("button", { name: "Add more", exact: true }) })
          .last()
          .locator('a[href^="/app/"]')
          .evaluateAll((els) =>
            els.map((e) => [e.getAttribute("href"), e.querySelector("span")?.textContent]),
          );
        if (!records.length) throw Error();
        step = "REOPEN";
        for (const [path, title] of records) {
          await page.goto(base + path);
          await page.getByText(title, { exact: true }).first().waitFor();
        }
        await mark(role + " " + mode + " capture review save reopen", "PASS");
      } catch {
        await mark(role + " " + mode + " capture review save reopen", step + "_FAILED");
      } finally {
        await browser.close();
      }
    }
    if (role === "business") {
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage({ storageState: state });
        await page.goto(base + "/app/billing");
        await page
          .getByText(
            new RegExp("Account AI captures.*" + monthlyLimit + " / " + monthlyLimit + " "),
          )
          .waitFor();
        await page
          .getByRole("button", { name: "Add anything", exact: true })
          .filter({ visible: true })
          .first()
          .click();
        await page.getByRole("button", { name: "Scan receipt", exact: true }).click();
        await page.locator("input[type=file]").setInputFiles(join(dir, "clear-receipt.jpg"));
        await page.locator("textarea").fill("Quota check " + runId);
        await page.getByRole("button", { name: "Let the AI read it" }).click();
        await page.getByText("You have reached your monthly allowance.", { exact: true }).waitFor();
        await mark("Business quota sixth capture", "PASS");
      } catch {
        await mark("Business quota sixth capture", "FAIL");
      } finally {
        await browser.close();
      }
    }
  };
  if (role === "individual") {
    await runCaptures();
  } else {
    const session = await chromium.launch();
    try {
      const page = await session.newPage({ storageState: state });
      const admin = await session.newPage();
      await admin.goto(base + "/super-admin/login");
      await admin.getByLabel("Email", { exact: true }).fill(process.env.SUPER_ADMIN_EMAIL);
      await admin.getByLabel("Password", { exact: true }).fill(process.env.SUPER_ADMIN_PASSWORD);
      await admin.locator("form button[type=submit]").click();
      await admin.waitForURL((url) => url.pathname.replace(/\/$/, "") === "/super-admin");
      const { data: rows, error } = await db
        .from("operation_reservations")
        .select("units")
        .eq("user_id", userId)
        .in("feature", ["capture", "speech"])
        .gte("created_at", new Date().toISOString().slice(0, 7) + "-01T00:00:00Z");
      if (error) throw Error("Cannot establish allowance baseline");
      const used = rows.reduce((sum, row) => sum + row.units, 0);
      await checkPlanPropagation({
        admin,
        page,
        db,
        base,
        key: "free",
        userId,
        executionId: runId + "-free",
        targetLimit: used + 5,
        exercise: runCaptures,
      });
      await mark("Restored published Free allowance after Business quota exercise", "PASS");
    } catch (e) {
      await mark("Business allowance exercise", e.safeStage ?? "FAIL");
    } finally {
      await session.close();
    }
  }
}
