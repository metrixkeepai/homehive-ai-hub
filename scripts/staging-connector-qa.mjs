import { fixtureQA } from "./connector-fixture-qa.mjs";
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
  let passed = true,
    reason = null,
    metrics = null;
  try {
    metrics = (await run()) ?? null;
  } catch (e) {
    reason = String(e?.message)
      .split("\n")[0]
      .replaceAll(email, "fixture")
      .replaceAll(password, "[redacted]")
      .slice(0, 200);
    console.error("QA:", name, String(e?.message).split("\n").slice(0, 2).join(" ").slice(0, 240));
    passed = false;
    failures++;
  }
  const r = await db
    .from("ai_benchmark_results")
    .insert({ sha, execution, sample: ++sample, observation: { name, passed, reason, metrics } });
  if (r.error) throw Error("Evidence unavailable");
  return passed;
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
    ["my-home", "QA property", []],
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
  const property = id("QA property");
  const rm = await db
    .from("home_items")
    .insert({ user_id: user.id, property_id: property, section: "rooms", title: "Utility room" });
  if (rm.error) throw Error("Room seed failed");
  const assign = await db
    .from("home_items")
    .update({ property_id: property })
    .eq("id", id("Bosch dishwasher"));
  if (assign.error) throw Error("Property seed failed");
  const l = await db.from("record_links").insert({
    user_id: user.id,
    source_item_id: id("Bosch dishwasher"),
    target_item_id: id("Currys receipt"),
    relationship_type: "EXTRACTED_FROM",
  });
  if (l.error) throw Error("Link failed");
  const authClient = createClient(SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
  const authenticated = await authClient.auth.signInWithPassword({ email, password });
  if (authenticated.error || !authenticated.data.session)
    throw Error("Could not sign in staging fixture.");
  await fixtureQA({
    db,
    auth: authClient,
    base,
    session: authenticated.data.session,
    user,
    property,
    check,
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const navigate = (url) => page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  const browserErrors = [];
  page.on("pageerror", (e) =>
    browserErrors.push(
      e.name +
        ":" +
        String(e.message)
          .replace(/https?:\/\/\S+/g, "[url]")
          .slice(0, 100),
    ),
  );
  const didLogin = await check("browser fixture sign-in", async () => {
    await navigate(base + "/auth");
    // Wait for client hydration before using the server-rendered form.
    const toggle = page.getByRole("button", { name: "Show password", exact: true });
    await toggle.click();
    await page.getByRole("button", { name: "Hide password", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
    try {
      await page.waitForURL(/\/app(?:\/|$)/, { timeout: 20000 });
    } catch {
      throw Error(
        "Login stayed at " +
          new URL(page.url()).pathname +
          "; " +
          browserErrors.slice(0, 2).join(" ") +
          " " +
          (await page.locator("[data-sonner-toast]").allTextContents()).join(" ").slice(0, 80),
      );
    }
  });
  if (!didLogin) {
    const client = createClient(SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    });
    const auth = await client.auth.signInWithPassword({ email, password });
    if (auth.error || !auth.data.session) throw Error("Fixture password sign-in failed");
    await page.addInitScript(
      ({ origin, session }) => {
        if (location.origin === origin)
          localStorage.setItem("sb-cdfpupivjjamhvmfcvry-auth-token", JSON.stringify(session));
      },
      { origin: base, session: auth.data.session },
    );
  }
  for (const [name, q, expected] of [
    ["count", "How many records are in assets?", "3 matching assets"],
    ["list", "List my assets.", "Kitchen kettle"],
    ["warranties", "Which warranties expire next?", "Dishwasher guarantee"],
    ["renewals", "What renewals are due soon?", "Boiler cover"],
    ["source", "What records came from Gmail?", "Currys receipt"],
    ["receipt", "Where is the receipt for my Bosch dishwasher?", "Currys receipt"],
    ["relationship", "Tell me everything about my Bosch dishwasher.", "Currys receipt"],
    ["property scope", "How many assets do I have?", "1 matching assets"],
    ["no result", "Where is my nonexistent ZirconWidget?", "couldn't find"],
  ]) {
    await check(name, async () => {
      // Respect the staging rate limit for this single, deliberately busy QA identity.
      const limit = await db
        .from("runtime_limits")
        .select("requests_per_minute")
        .eq("singleton", true)
        .single();
      const recent = await db
        .from("operation_reservations")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", new Date(Date.now() - 60000).toISOString())
        .order("created_at");
      if (limit.error || recent.error) throw Error("QA pacing unavailable");
      if (recent.data.length >= limit.data.requests_per_minute)
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.max(0, Date.parse(recent.data[0].created_at) + 61500 - Date.now()),
          ),
        );
      await navigate(base + (name === "property scope" ? "/app/my-home/" + property : "/app"));
      await page.getByRole("button", { name: "Ask Sera", exact: true }).click();
      await page.getByPlaceholder("Where's the receipt for the TV?").fill(q);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page
        .locator("p.whitespace-pre-wrap.mr-8")
        .filter({ hasText: expected })
        .waitFor({ timeout: 35000 })
        .catch(async () => {
          throw Error(
            "Reply: " + (await page.locator("p.mr-8").allTextContents()).join(" ").slice(0, 160),
          );
        });
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
      await navigate(base + "/app/integrations/gmail");
      await page.getByRole("button", { name: "Review", exact: true }).click();
      await page.getByRole("button", { name: /Save 1 record/ }).waitFor();
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1))
        throw Error("Overflow");
    });
  await check("approve and persist", async () => {
    await page.getByLabel("Property", { exact: true }).selectOption(property);
    await page.getByLabel("Room", { exact: true }).selectOption({ label: "Utility room" });
    await page.getByRole("button", { name: /Save 1 record/ }).click();
    await page
      .getByText(/Saved to /)
      .first()
      .waitFor();
    let r = await db
      .from("home_items")
      .select("id,fields,property_id")
      .eq("user_id", user.id)
      .eq("title", "Reviewed kettle");
    if (
      r.data?.length !== 1 ||
      r.data[0].property_id !== property ||
      !JSON.stringify(r.data[0].fields).includes("Utility room") ||
      !JSON.stringify(r.data[0].fields).includes("Gmail")
    )
      throw Error("Missing saved record");
  });
  await check("approved record activity and insight", async () => {
    const r = await db
      .from("home_items")
      .select("id")
      .eq("user_id", user.id)
      .eq("title", "Reviewed kettle")
      .single();
    if (!r.data) throw Error("Approved record unavailable");
    await navigate(base + "/app/assets/" + r.data.id);
    await page.getByRole("button", { name: "Activity", exact: true }).click();
    await page.getByText(/You reviewed.*Reviewed kettle/).waitFor();
    await page.getByRole("button", { name: /^AI insight$/i }).click();
    await page.getByText(/Adding the serial number/).waitFor();
  });
  await check("Super Admin connector monitoring", async () => {
    const admin = await browser.newPage();
    admin.setDefaultTimeout(35000);
    try {
      await admin.goto(base + "/super-admin/login", { waitUntil: "domcontentloaded" });
      await admin.getByLabel("Email", { exact: true }).fill(process.env.SUPER_ADMIN_EMAIL);
      await admin.getByLabel("Password", { exact: true }).fill(process.env.SUPER_ADMIN_PASSWORD);
      await admin.locator("form button[type=submit]").click();
      await admin.waitForURL((url) => /^\/super-admin\/?$/.test(url.pathname));
      await admin.goto(base + "/super-admin/integrations", { waitUntil: "domcontentloaded" });
      const configured = {};
      for (const provider of ["Gmail", "Google Drive", "Outlook", "OneDrive"]) {
        const card = admin
          .locator("article")
          .filter({ has: admin.getByRole("heading", { name: provider, exact: true }) });
        await card.getByText(/AI calls.*estimated provider cost/).waitFor();
        await card.getByText(/Background checks:.*successful/).waitFor();
        configured[provider] = (await card.getByText(/^Configured ·/).count()) > 0;
      }
      return { configured };
    } catch {
      throw Error("Staging administrator login or metrics verification failed");
    } finally {
      await admin.close();
    }
  });
} finally {
  await browser.close();
  await db.auth.admin.updateUserById(user.id, { ban_duration: "8760h" });
}
if (failures) throw Error(failures + " staging QA checks failed");
