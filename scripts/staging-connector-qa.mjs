import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
const {
  QA_CANDIDATE: base,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  QA_SHA: sha,
  CLOUD_RUN_EXECUTION: execution,
} = process.env;
if (
  SUPABASE_URL?.replace(/\/$/, "") !== "https://cdfpupivjjamhvmfcvry.supabase.co" ||
  !/^https:\/\/qa-\d+-\d+---matrixkeep-staging-web-[\w-]+\.a\.run\.app$/.test(base)
)
  throw Error("Unexpected staging target");
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const email = "metrixkeepai+connectors-" + randomUUID() + "@gmail.com",
  password = randomUUID() + randomUUID();
const user = (await db.auth.admin.createUser({ email, password, email_confirm: true })).data.user;
if (!user) throw Error("Fixture unavailable");
let sample = 0,
  failures = 0;
const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
async function check(name, run) {
  let passed = true;
  try {
    await run();
  } catch {
    passed = false;
    failures++;
  }
  const r = await db
    .from("ai_benchmark_results")
    .insert({ sha, execution, sample: ++sample, observation: { name, passed } });
  if (r.error) throw Error("Evidence unavailable");
}
try {
  await db
    .from("profiles")
    .update({
      plan: "family",
      plan_source: "trial",
      trial_ends_at: new Date(Date.now() + 3600000).toISOString(),
    })
    .eq("id", user.id);
  const due = new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10);
  const rows = [
    ["assets", "Bosch dishwasher", []],
    ["assets", "Godrej fridge", []],
    ["assets", "Kitchen kettle", []],
    ["documents", "Currys receipt", [["Source", "Gmail"]]],
    ["documents", "Manual", []],
    ["warranties", "Dishwasher guarantee", [["Expiry date", due]]],
    ["warranties", "Old cover", [["Expiry date", "2020-01-02"]]],
    ["renewals", "Boiler cover", [["Renewal date", due]]],
    ["renewals", "Old renewal", [["Renewal date", "2020-01-02"]]],
    ["maintenance", "Boiler visit", []],
    ["insurance", "Home policy", []],
  ];
  const seed = await db
    .from("home_items")
    .insert(rows.map(([section, title, fields]) => ({ user_id: user.id, section, title, fields })))
    .select("id,title");
  if (seed.error) throw Error("Seed failed");
  const id = (t) => seed.data.find((x) => x.title === t).id;
  const l = await db.from("record_links").insert({
    user_id: user.id,
    source_item_id: id("Bosch dishwasher"),
    target_item_id: id("Currys receipt"),
    relationship_type: "EXTRACTED_FROM",
  });
  if (l.error) throw Error("Link failed");
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(base + "/auth");
  await page.locator("input[type=email]").fill(email);
  await page.locator("input[type=password]").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/app(?:\/|$)/);
  for (const [name, q, expected] of [
    ["count", "How many records are in assets?", "3 matching assets"],
    ["list", "List my assets.", "Kitchen kettle"],
    ["warranties", "Which warranties expire next?", "Dishwasher guarantee"],
    ["renewals", "What renewals are due soon?", "Boiler cover"],
    ["source", "What records came from Gmail?", "Currys receipt"],
    ["receipt", "Where is the receipt for my Bosch dishwasher?", "Currys receipt"],
    ["relationship", "Tell me everything about my Bosch dishwasher.", "Currys receipt"],
    ["no result", "Where is my nonexistent ZirconWidget?", "couldn't find"],
  ]) {
    await check(name, async () => {
      await page.goto(base + "/app");
      await page.getByRole("button", { name: "Ask Sera", exact: true }).click();
      await page.getByPlaceholder("Where's the receipt for the TV?").fill(q);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page
        .locator("p.whitespace-pre-wrap.mr-8")
        .filter({ hasText: expected })
        .waitFor({ timeout: 45000 });
    });
  }
  const draft = await db.from("connector_reviews").insert({
    user_id: user.id,
    provider: "google_mail",
    external_key: randomUUID(),
    title: "Fixture purchase",
    source: [
      ["Source", "Gmail"],
      ["Sender", "QA fixture"],
    ],
    proposals: [
      {
        section: "assets",
        title: "Reviewed kettle",
        subtitle: "",
        fields: [{ label: "Price", value: "£65" }],
        relates_to: "",
      },
    ],
  });
  if (draft.error) throw Error("Review seed failed");
  for (const width of [320, 375, 390, 430, 768, 1024])
    await check("review width " + width, async () => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(base + "/app/integrations/gmail");
      await page.getByRole("button", { name: "Review", exact: true }).click();
      await page.getByRole("button", { name: /Save 1 record/ }).waitFor();
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1))
        throw Error("Overflow");
    });
  await check("approve and persist", async () => {
    await page.getByRole("button", { name: /Save 1 record/ }).click();
    await page
      .getByText(/Saved to /)
      .first()
      .waitFor();
    let r = await db
      .from("home_items")
      .select("id,fields")
      .eq("user_id", user.id)
      .eq("title", "Reviewed kettle");
    if (r.data?.length !== 1 || !JSON.stringify(r.data[0].fields).includes("Gmail"))
      throw Error("Missing saved record");
  });
} finally {
  await browser.close();
  await db.auth.admin.updateUserById(user.id, { ban_duration: "8760h" });
}
if (failures) throw Error(failures + " staging QA checks failed");
