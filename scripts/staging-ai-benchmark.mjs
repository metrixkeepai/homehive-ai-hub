// Run inside the isolated GCP staging job, before candidate traffic is switched.
import { readFileSync, readdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { toJSONAsync, fromCrossJSON } from "seroval";

const env = process.env,
  origin = "https://matrixkeep-staging-web-893477687403.europe-west2.run.app";
const candidate = new URL(env.QA_CANDIDATE);
if (
  env.APP_ENV !== "staging" ||
  env.SUPABASE_URL?.replace(/\/$/, "") !== "https://cdfpupivjjamhvmfcvry.supabase.co" ||
  candidate.protocol !== "https:" ||
  !/^qa-\d+-\d+---matrixkeep-staging-web-[a-z0-9-]+\.a\.run\.app$/.test(candidate.hostname)
)
  throw Error("Unexpected target");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const auth = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const dir = mkdtempSync(join(tmpdir(), "mk-ai-"));
execFileSync("python3", ["scripts/ai-benchmark-fixtures.py", dir]);
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8"));
const manifest = readFileSync(
  join(
    ".output/server",
    readdirSync(".output/server").find((n) => n.includes("server-fn-resolver")),
  ),
  "utf8",
);
const idFor = (name) =>
  manifest.match(
    new RegExp('"([a-f0-9]{64})": \\{\\s*functionName: "' + name + '_createServerFn_handler"'),
  )?.[1];
const email = "metrixkeepai+benchmark-" + randomUUID() + "@gmail.com",
  password = randomUUID() + randomUUID();
const user = (await db.auth.admin.createUser({ email, password, email_confirm: true })).data.user;
if (!user) throw Error("Benchmark fixture unavailable");
try {
  const patch = await db
    .from("profiles")
    .update({
      plan: "family",
      plan_source: "trial",
      trial_ends_at: new Date(Date.now() + 3600000).toISOString(),
    })
    .eq("id", user.id);
  if (patch.error) throw Error("Fixture trial unavailable");
  const seed = await db.from("home_items").insert({
    user_id: user.id,
    title: "Harbour kettle",
    section: "assets",
    fields: [["Model", "TWK7203"]],
  });
  if (seed.error) throw Error("Fixture data unavailable");
  const token = (await auth.auth.signInWithPassword({ email, password })).data.session
    ?.access_token;
  if (!token) throw Error("Fixture login failed");
  let scores = new Map();
  for (const [label, base] of [
    ["baseline", origin],
    ["candidate", candidate.origin],
  ]) {
    const since = new Date().toISOString();
    let passed = 0,
      operations = 0;
    for (const spec of cases) {
      const data = { ...spec.data };
      if (spec.file)
        data.image =
          "data:image/jpeg;base64," + readFileSync(resolve(dir, spec.file)).toString("base64");
      if (spec.audio) data.audio = readFileSync(join(dir, spec.audio)).toString("base64");
      const started = Date.now();
      const r = await fetch(base + "/_serverFn/" + idFor(spec.fn), {
        method: "POST",
        redirect: "error",
        headers: {
          origin: base,
          authorization: "Bearer " + token,
          "x-tsr-serverfn": "true",
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(await toJSONAsync({ data })),
        signal: AbortSignal.timeout(135000),
      });
      const returned = r.ok ? fromCrossJSON(await r.json(), { refs: new Map() }) : null;
      const result = returned?.result ?? returned;
      const content = JSON.stringify(spec.audio ? result?.english : result)?.toLowerCase() ?? "";
      const assertions = [
        !!result && !result.error && r.ok,
        ...spec.facts.map((f) => new RegExp(f, "i").test(content)),
        ...(spec.sections ?? []).map((s) => result?.records?.some((x) => x.section === s) ?? false),
      ];
      if (spec.language) assertions.push(result?.language?.toLowerCase() === spec.language);
      const points = assertions.filter(Boolean).length;
      scores.set(label + ":" + spec.kind, [points, assertions.length]);
      operations++;
      if (points === assertions.length) passed++;
      console.log(
        JSON.stringify({
          label,
          kind: spec.kind,
          http: r.status,
          points,
          possible: assertions.length,
          latency_ms: Date.now() - started,
        }),
      );
      if (!r.ok || result?.error || !result)
        throw Error("Benchmark application request failed: " + spec.kind);
      // Stay within the ordinary staging fixture's request rate.
      await new Promise((resolve) => setTimeout(resolve, 6000));
    }
    const logs = await db
      .from("ai_usage_log")
      .select("model,feature,input_tokens,output_tokens,cost_usd,audio_seconds,usage_details")
      .eq("user_id", user.id)
      .gte("created_at", since);
    if (logs.error) throw Error("Benchmark ledger unavailable");
    console.log(
      JSON.stringify({
        label,
        operations,
        all_assertions_passed: passed,
        usage: logs.data.map(({ usage_details, ...row }) => ({
          ...row,
          cached_tokens: usage_details?.cached_tokens ?? null,
        })),
      }),
    );
  }
  for (const spec of cases) {
    const [before] = scores.get("baseline:" + spec.kind),
      [after, possible] = scores.get("candidate:" + spec.kind);
    if (after < before || after < possible)
      throw Error("Quality gate requires review: " + spec.kind);
  }
} finally {
  // Expire only this execution's synthetic test user's session and trial.
  await db.auth.admin.updateUserById(user.id, { ban_duration: "8760h" });
}
