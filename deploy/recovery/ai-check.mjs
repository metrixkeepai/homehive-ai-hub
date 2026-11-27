// Invoked inside a short-lived job using the serving identity and its pinned bindings.
import assert from "node:assert/strict";
const target = process.env.APP_ENV;
const ref = { production: "caqtifaytqukimdkyahv", staging: "cdfpupivjjamhvmfcvry" }[target];
const base = process.env.SUPABASE_URL.replace(/\/$/, "");
assert.equal(base, "https://" + ref + ".supabase.co");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: "Bearer " + key };
async function query(path, init = {}) {
  const r = await fetch(base + "/rest/v1/" + path, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  if (!r.ok) throw Error("AI configuration query failed: " + r.status);
  return r.json();
}
const [limits] = await query(
  "runtime_limits?singleton=eq.true&select=ai_enabled,daily_ai_budget_usd,billing_environment",
);
assert.equal(limits.billing_environment, target === "production" ? "live" : "sandbox");
const budget = Number(limits.daily_ai_budget_usd);
// Sum the same settled-or-reserved amounts used by the daily ledger trigger.
// The web identity already has read access to reservations in both environments.
const day = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.parse(day + "T00:00:00Z") + 86400000).toISOString();
const ledger =
  "operation_reservations?select=settled_usd,reserved_usd&feature=not.in.(share,report)&created_at=gte." +
  day +
  "T00:00:00Z&created_at=lt." +
  tomorrow +
  "&order=id&limit=500";
let heldAndSpent = 0;
for (let offset = 0; ; offset += 500) {
  const rows = await query(ledger + "&offset=" + offset);
  for (const row of rows) heldAndSpent += Number(row.settled_usd ?? row.reserved_usd);
  if (rows.length < 500) break;
}
assert.ok(budget > heldAndSpent, "AI daily budget unavailable");
const flags = await query(
  "feature_flags?select=key,enabled,rollout&key=in.(capture_ai,speech_capture)",
);
assert.ok(
  flags.length === 2 && flags.every((f) => f.enabled && f.rollout === 100),
  "Capture or speech rollout disabled",
);
for (const model of ["gpt-6-luna", "gpt-transcribe", "gpt-6.1-sol"]) {
  const r = await fetch("https://api.openai.com/v1/models/" + model, {
    headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY },
  });
  if (!r.ok) throw Error("AI provider/model check failed: " + r.status);
}
const mode = process.env.CHECK_MODE;
if (!limits.ai_enabled && mode === "activate" && target === "production") {
  const rows = await query(
    "runtime_limits?singleton=eq.true&ai_enabled=eq.false&billing_environment=eq.live&select=ai_enabled",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ ai_enabled: true }),
    },
  );
  assert.equal(rows[0]?.ai_enabled, true, "AI activation failed");
} else if (!limits.ai_enabled) {
  assert.equal(mode, "pending-activation", "AI_DISABLED: runtime advertises capture and speech");
}
console.log(
  JSON.stringify({
    environment: target,
    budget,
    ai_enabled: limits.ai_enabled || mode === "activate",
    provider: "model checks passed",
  }),
);
