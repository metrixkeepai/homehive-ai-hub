// Exercise the actual recorder with the labelled synthetic WAV as a Chromium microphone.
import { chromium } from "playwright";
import { statSync } from "node:fs";
import { join } from "node:path";
import { hasExactGbp } from "../src/lib/speech-facts.ts";
export async function browserSpeech({ dir, cases, base, email, password, db, userId, record }) {
  let passed = true;
  for (const spec of cases.filter((s) => s.audio && !s.kind.includes("noisy"))) {
    const path = join(dir, spec.audio);
    const browser = await chromium.launch({
      args: [
        "--disable-dev-shm-usage",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--use-file-for-fake-audio-capture=" + path + "%noloop",
      ],
    });
    const steps = {
      login: false,
      automaticUi: false,
      record: false,
      translation: false,
      review: false,
      save: false,
    };
    try {
      const page = await browser.newPage({ permissions: ["microphone"] });
      page.setDefaultTimeout(12000);
      await page.goto(base + "/auth");
      await page.locator("input[type=email]").fill(email);
      await page.locator("input[type=password]").fill(password);
      await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(/\/app(?:\/|$)/);
      steps.login = true;
      await page
        .getByRole("button", { name: "Add anything", exact: true })
        .filter({ visible: true })
        .first()
        .click();
      await page.getByRole("button", { name: "Speak", exact: true }).click();
      await page.getByText("Detect automatically", { exact: true }).waitFor();
      steps.automaticUi = !(await page.getByRole("combobox", { name: /language/i }).count());
      await page.getByRole("button", { name: "Tap and speak" }).click();
      await page.getByRole("button", { name: /Listening.*finish/ }).waitFor();
      await new Promise((resolve) =>
        setTimeout(resolve, Math.ceil(statSync(path).size / 32) + 350),
      );
      await page.getByRole("button", { name: /Listening.*finish/ }).click();
      steps.record = true;
      const box = page.getByPlaceholder("Your words appear here — you can also type.");
      await page.waitForFunction(
        () =>
          document.querySelector("textarea")?.value ||
          document.body.innerText.includes("couldn't confidently"),
        null,
        { timeout: 65000 },
      );
      const english = await box.inputValue();
      steps.translation =
        hasExactGbp(english, 65) && /\bBosch\b/i.test(english) && /\bkettle\b/i.test(english);
      if (!steps.translation) continue;
      await page.getByRole("button", { name: "Let the AI read it" }).click();
      const save = page.getByRole("button", { name: /Save \d+ record/ });
      await save.waitFor({ timeout: 45000 });
      const reviewed = await page
        .locator("input,textarea,dd")
        .evaluateAll((els) => els.map((e) => e.value ?? e.textContent).join(" "));
      steps.review =
        hasExactGbp(reviewed, 65) && /Bosch/i.test(reviewed) && /kettle/i.test(reviewed);
      if (!steps.review) continue;
      const since = new Date().toISOString();
      await save.click();
      await page
        .getByText(/Saved to /)
        .first()
        .waitFor();
      const { data, error } = await db
        .from("home_items")
        .select("title,fields")
        .eq("user_id", userId)
        .gte("created_at", since);
      if (!error)
        steps.save = data.some(
          (r) =>
            /kettle/i.test(r.title) &&
            /Bosch/i.test(JSON.stringify(r)) &&
            hasExactGbp(JSON.stringify(r.fields), 65),
        );
    } catch {
      /* report the last successful UI step without collecting page content */
    } finally {
      await browser.close();
      if (!Object.values(steps).every(Boolean)) passed = false;
      await record(JSON.stringify({ label: "synthetic-browser", kind: spec.kind, steps }));
    }
  }
  return passed;
}
