import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createExecutionIdentity } from "../../scripts/staging-qa-identity.mjs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Real PostgreSQL permission/RLS execution. The Supabase auth/storage schemas below
// provide infrastructure normally installed by Supabase; no application policy is mocked.
let db;
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const workspace = "33333333-3333-4333-8333-333333333333";
const item = "44444444-4444-4444-8444-444444444444";
async function asUser(id, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(
      `SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)`,
      [id],
    );
    await tx.exec("SET LOCAL ROLE authenticated");
    return tx.query(sql, params);
  });
}
before(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    CREATE EXTENSION pgcrypto;
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text, name text, metadata jsonb);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1, '/') $$;
    GRANT USAGE ON SCHEMA public, auth, storage TO authenticated, anon, service_role;
  `);
  const dir = new URL("../../drizzle/migrations/", import.meta.url);
  for (const file of (await readdir(dir)).filter((f) => /^\d+.*\.sql$/.test(f)).sort()) {
    await db.exec(await readFile(new URL(file, dir), "utf8"));
  }
  await db.query(
    `INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ($1,'a@example.test','{"account_type":"business"}'),($2,'b@example.test','{}')`,
    [a, b],
  );
  await db.query(
    `INSERT INTO public.workspaces(id,owner_id,name) VALUES($1,$2,'Other workspace')`,
    [workspace, b],
  );
  await db.query(
    `INSERT INTO public.home_items(id,user_id,workspace_id,section,title) VALUES($1,$2,$3,'assets','Private')`,
    [item, b, workspace],
  );
  await db.query(`INSERT INTO public.user_roles(user_id,role) VALUES($1,'super_admin')`, [b]);
});
after(async () => {
  await db?.close();
});

test("ordinary profile edits work, privileged updates and upserts do not", async () => {
  await asUser(a, `UPDATE public.profiles SET display_name='Allowed' WHERE id=$1`, [a]);
  for (const field of [
    "plan='business_scale'",
    "plan_source='stripe'",
    "trial_ends_at=NULL",
    "suspended=false",
    "limit_overrides='{}'",
    "voucher_ends_at=NULL",
  ]) {
    await assert.rejects(
      asUser(a, `UPDATE public.profiles SET ${field} WHERE id=$1`, [a]),
      /permission denied/,
    );
  }
  await assert.rejects(
    asUser(
      a,
      `INSERT INTO public.profiles(id,plan) VALUES($1,'business_scale') ON CONFLICT(id) DO UPDATE SET plan=EXCLUDED.plan`,
      [a],
    ),
    /permission denied/,
  );
});
test("role probing is limited to the authenticated identity", async () => {
  assert.equal(
    (await asUser(a, `SELECT public.has_role($1,'super_admin') AS allowed`, [b])).rows[0].allowed,
    false,
  );
  assert.equal(
    (await asUser(b, `SELECT public.has_role($1,'super_admin') AS allowed`, [b])).rows[0].allowed,
    true,
  );
  await assert.rejects(
    asUser(a, `INSERT INTO public.user_roles(user_id,role) VALUES($1,'super_admin')`, [a]),
    /permission denied/,
  );
});
test("cross-workspace reads, inserts and moves fail", async () => {
  assert.equal(
    (await asUser(a, "SELECT * FROM public.home_items WHERE id=$1", [item])).rows.length,
    0,
  );
  await assert.rejects(
    asUser(
      a,
      `INSERT INTO public.home_items(workspace_id,section,title) VALUES($1,'assets','Attack')`,
      [workspace],
    ),
    { code: "42501" },
  );
  const own = await asUser(
    a,
    `INSERT INTO public.home_items(section,title) VALUES('assets','Own') RETURNING id`,
  );
  await assert.rejects(
    asUser(a, `UPDATE public.home_items SET workspace_id=$1 WHERE id=$2`, [
      workspace,
      own.rows[0].id,
    ]),
    { code: "42501" },
  );
});
test("cross-account attachment and record-link references fail", async () => {
  await assert.rejects(
    asUser(a, `INSERT INTO public.evidence_files(item_id,path,name) VALUES($1,$2,'File')`, [
      item,
      `${a}/file.pdf`,
    ]),
    { code: "42501" },
  );
  const own = await asUser(
    a,
    `INSERT INTO public.home_items(section,title) VALUES('assets','Link source') RETURNING id`,
  );
  await assert.rejects(
    asUser(
      a,
      `INSERT INTO public.record_links(source_item_id,target_item_id,relationship_type) VALUES($1,$2,'related')`,
      [own.rows[0].id, item],
    ),
    { code: "42501" },
  );
});
test("trial can be granted once and remains consumed even if a trusted process clears profile dates", async () => {
  await asUser(a, "SELECT public.start_business_trial()");
  await assert.rejects(asUser(a, "SELECT public.start_business_trial()"), /Trial unavailable/);
  await assert.rejects(asUser(a, "DELETE FROM public.trial_history"), /permission denied/);
  await db.query(`UPDATE public.profiles SET plan='free', trial_ends_at=NULL WHERE id=$1`, [a]);
  await assert.rejects(asUser(a, "SELECT public.start_business_trial()"), /Trial unavailable/);
});
test("suspended owners cannot read or create workspace records", async () => {
  await db.query("UPDATE public.profiles SET suspended=true WHERE id=$1", [b]);
  assert.equal((await asUser(b, "SELECT * FROM public.home_items")).rows.length, 0);
  await assert.rejects(
    asUser(b, `INSERT INTO public.home_items(section,title) VALUES('assets','Blocked')`),
    { code: "42501" },
  );
  await assert.rejects(asUser(b, `INSERT INTO public.workspaces(name) VALUES('Blocked')`), {
    code: "42501",
  });
});

test("direct inserts cannot bypass record capacities or use unknown sections", async () => {
  await asUser(
    a,
    `INSERT INTO public.home_items(section,title) VALUES('rooms','One'),('rooms','Two'),('rooms','Three')`,
  );
  await assert.rejects(
    asUser(a, `INSERT INTO public.home_items(section,title) VALUES('rooms','Four')`),
    /Plan capacity reached/,
  );
  await assert.rejects(
    asUser(a, `INSERT INTO public.home_items(section,title) VALUES('arbitrary-premium','Bypass')`),
    { code: "42501" },
  );
  await assert.rejects(
    asUser(a, `INSERT INTO public.home_items(section,title) VALUES('vehicles','Free vehicle')`),
    /Plan feature unavailable/,
  );
});
test("service providers persist in the owner's workspace", async () => {
  const [saved] = (
    await asUser(
      a,
      "INSERT INTO public.home_items(section,title) VALUES('services','Staging provider') RETURNING id",
    )
  ).rows;
  const owned = await asUser(a, "SELECT title FROM public.home_items WHERE id=$1", [saved.id]);
  assert.equal(owned.rows[0].title, "Staging provider");
  const foreign = await asUser(b, "SELECT id FROM public.home_items WHERE id=$1", [saved.id]);
  assert.equal(foreign.rows.length, 0);
});
test("service reservations enforce identity, monthly quotas and emergency ceilings", async () => {
  await assert.rejects(
    asUser(a, `SELECT public.reserve_operation($1,NULL,'capture',1)`, [a]),
    /permission denied/,
  );
  await assert.rejects(
    db.query(`SELECT public.reserve_operation($1,NULL,'capture',1)`, [a]),
    /Service temporarily unavailable/,
  );
  await db.exec("UPDATE public.runtime_limits SET ai_enabled=true");
  await assert.rejects(
    db.query(`SELECT public.reserve_operation($1,$2,'capture',1)`, [a, workspace]),
    /Workspace unavailable/,
  );
  for (let i = 0; i < 5; i++)
    await db.query(`SELECT public.reserve_operation($1,NULL,'capture',1)`, [a]);
  await assert.rejects(
    db.query(`SELECT public.reserve_operation($1,NULL,'speech',1)`, [a]),
    /Monthly quota reached/,
  );
  await db.exec("UPDATE public.runtime_limits SET daily_ai_budget_usd=0.05");
  await assert.rejects(
    db.query(`SELECT public.reserve_operation($1,NULL,'sera',1)`, [a]),
    /Platform AI budget reached/,
  );
  await db.exec("UPDATE public.runtime_limits SET daily_ai_budget_usd=100, requests_per_minute=5");
  await assert.rejects(
    db.query(`SELECT public.reserve_operation($1,NULL,'sera',1)`, [a]),
    /Rate limit reached/,
  );
});

test("billing updates are bound, atomic, idempotent and isolated by environment", async () => {
  await db.exec("UPDATE public.runtime_limits SET billing_environment='sandbox'");
  await db.query(
    "INSERT INTO public.billing_customers(user_id,environment,customer_id) VALUES($1,'sandbox','cus_owner')",
    [a],
  );
  const subscription = {
    id: "sub_owner",
    customer: "cus_owner",
    product: "prod_home",
    price: "price_home",
    status: "active",
    period_start: new Date().toISOString(),
    period_end: new Date(Date.now() + 86400000).toISOString(),
    cancel_at_period_end: false,
  };
  const apply = (event, created, environment = "sandbox", sub = subscription, paid = true) =>
    db.query("SELECT public.apply_billing_event($1,$2,$3,$4::jsonb,$5,$6) AS changed", [
      event,
      created,
      environment,
      JSON.stringify(sub),
      "home",
      paid,
    ]);
  await assert.rejects(apply("evt_wrong", 1, "live"), /Billing environment mismatch/);
  await assert.rejects(
    apply("evt_unknown", 1, "sandbox", { ...subscription, customer: "cus_unknown" }),
    /Unknown billing customer/,
  );
  assert.equal((await apply("evt_paid", 10)).rows[0].changed, true);
  assert.equal((await apply("evt_paid", 10)).rows[0].changed, false);
  assert.equal(
    (await db.query("SELECT plan FROM public.profiles WHERE id=$1", [a])).rows[0].plan,
    "home",
  );
  assert.equal(
    (await apply("evt_old", 5, "sandbox", { ...subscription, status: "canceled" }, false)).rows[0]
      .changed,
    false,
  );
  assert.equal(
    (await db.query("SELECT plan FROM public.profiles WHERE id=$1", [a])).rows[0].plan,
    "home",
  );
  await apply("evt_failed", 20, "sandbox", { ...subscription, status: "past_due" }, false);
  assert.equal(
    (await db.query("SELECT plan FROM public.profiles WHERE id=$1", [a])).rows[0].plan,
    "free",
  );
  await assert.rejects(
    asUser(
      a,
      "SELECT public.apply_billing_event('evt_attack',30,'sandbox',$1::jsonb,'business_scale',true)",
      [JSON.stringify(subscription)],
    ),
    /permission denied/,
  );
});

test("record field validation applies to updates too", async () => {
  await db.query("UPDATE public.profiles SET suspended=false WHERE id=$1", [b]);
  await assert.rejects(
    asUser(b, `UPDATE public.home_items SET fields='{}' WHERE id=$1`, [item]),
    /Invalid record fields/,
  );
  await assert.rejects(
    asUser(b, `UPDATE public.home_items SET fields=$2::jsonb WHERE id=$1`, [
      item,
      JSON.stringify([{ value: "x".repeat(66000) }]),
    ]),
    /Invalid record fields/,
  );
});

test("expired Stripe periods fail closed without waiting for webhooks", async () => {
  await db.query("UPDATE public.profiles SET plan='home',plan_source='stripe' WHERE id=$1", [a]);
  await db.query(
    "UPDATE public.subscriptions SET status='active',current_period_end=now()-interval '1 second' WHERE user_id=$1",
    [a],
  );
  const actual = (await db.query("SELECT public.account_entitlements($1) AS ent", [a])).rows[0].ent;
  const free = (
    await db.query("SELECT entitlements AS ent FROM public.plan_defaults WHERE plan_key='free'")
  ).rows[0].ent;
  assert.deepEqual(actual, free);
});

test("storage metadata enforces item ownership, type, size and account quota", async () => {
  const insert = (path, metadata) =>
    db.query(
      "INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('evidence',$1,$2::jsonb)",
      [path, JSON.stringify(metadata)],
    );
  await assert.rejects(
    insert(`${a}/${item}/wrong.pdf`, { size: 10, mimetype: "application/pdf" }),
    /Upload record unavailable/,
  );
  await assert.rejects(
    insert(`${b}/${item}/bad.html`, { size: 10, mimetype: "text/html" }),
    /Unsupported upload/,
  );
  await assert.rejects(
    insert(`${b}/${item}/large.pdf`, { size: 20971521, mimetype: "application/pdf" }),
    /Unsupported upload/,
  );
  const pending = `${b}/${item}/pending.pdf`;
  await insert(pending, { mimetype: "application/pdf" });
  await assert.rejects(
    db.query("UPDATE storage.objects SET metadata=metadata WHERE name=$1", [pending]),
    /Upload size unavailable/,
  );
  await assert.rejects(
    db.query("UPDATE storage.objects SET metadata=$2::jsonb WHERE name=$1", [
      pending,
      JSON.stringify({ contentLength: 20971521, mimetype: "application/pdf" }),
    ]),
    /Unsupported upload/,
  );
  await db.query("UPDATE storage.objects SET metadata=$2::jsonb WHERE name=$1", [
    pending,
    JSON.stringify({ contentLength: 5, mimetype: "application/pdf" }),
  ]);
  await db.exec("SELECT set_config('request.jwt.claim.role', 'service_role', false)");
  await db.query("UPDATE public.profiles SET limit_overrides='{\"storage\":100}' WHERE id=$1", [b]);
  await insert(`${b}/${item}/first.pdf`, { size: 60, mimetype: "application/pdf" });
  await assert.rejects(
    insert(`${b}/${item}/next.pdf`, { size: 60, mimetype: "application/pdf" }),
    /Storage quota reached/,
  );
});

test("Passport shares require owned paid records and revoke guest access", async () => {
  await db.query(
    "UPDATE public.profiles SET plan='home',plan_source='admin',suspended=false WHERE id=$1",
    [b],
  );
  await db.exec("UPDATE public.runtime_limits SET requests_per_minute=60");
  await assert.rejects(
    asUser(
      a,
      `INSERT INTO public.passport_shares(item_id,workspace_id,title,html,expires_at) VALUES($1,$2,'Wrong','<p>no</p>',now()+interval '1 day')`,
      [item, workspace],
    ),
    /Share record unavailable/,
  );
  await assert.rejects(
    asUser(
      b,
      `INSERT INTO public.passport_shares(item_id,workspace_id,title,html,expires_at) VALUES($1,$2,'Long','<p>no</p>',now()+interval '31 days')`,
      [item, workspace],
    ),
    /Invalid share/,
  );
  const share = (
    await asUser(
      b,
      `INSERT INTO public.passport_shares(item_id,workspace_id,title,html,expires_at) VALUES($1,$2,'Saved','<p>Shared fields</p>',now()+interval '1 day') RETURNING id,token`,
      [item, workspace],
    )
  ).rows[0];
  assert.equal(
    (await asUser(a, "SELECT * FROM public.passport_shares WHERE id=$1", [share.id])).rows.length,
    0,
  );
  await assert.rejects(
    asUser(b, "UPDATE public.passport_shares SET html='<p>changed</p>' WHERE id=$1", [share.id]),
    /permission denied/,
  );
  assert.equal(
    (await db.query("SELECT * FROM public.open_passport_share($1)", [share.token])).rows.length,
    1,
  );
  await asUser(b, "UPDATE public.passport_shares SET revoked=true WHERE id=$1", [share.id]);
  assert.equal(
    (await db.query("SELECT * FROM public.open_passport_share($1)", [share.token])).rows.length,
    0,
  );
  await asUser(b, "UPDATE public.passport_shares SET revoked=false WHERE id=$1", [share.id]);
  await db.query(
    "UPDATE public.passport_shares SET expires_at=now()-interval '1 second' WHERE id=$1",
    [share.id],
  );
  assert.equal(
    (await db.query("SELECT * FROM public.open_passport_share($1)", [share.token])).rows.length,
    0,
  );
});

test("feature switches are enforced by the reservation RPC", async () => {
  await db.exec("UPDATE public.feature_flags SET enabled=false WHERE key='sera_text'");
  await assert.rejects(
    db.query("SELECT public.reserve_operation($1,NULL,'sera',1)", [b]),
    /Feature temporarily unavailable/,
  );
  assert.equal(
    (await db.query("SELECT public.feature_enabled($1,'missing') AS allowed", [b])).rows[0].allowed,
    false,
  );
  await assert.rejects(
    asUser(b, "SELECT public.feature_enabled($1,'sera_text')", [b]),
    /permission denied/,
  );
});

test("a location passport lists only records linked to that location", async () => {
  const owner = "66c10142-0000-4000-8000-000000000001";
  await db.query("INSERT INTO auth.users(id,email) VALUES ($1,'locations@example.test')", [owner]);
  await db.query(
    "UPDATE public.profiles SET account_type='business', plan='business_scale' WHERE id=$1",
    [owner],
  );
  const locations = await asUser(
    owner,
    "INSERT INTO public.home_items(section,title) VALUES ('locations','North'),('locations','South') RETURNING id",
  );
  for (const { id } of locations.rows) {
    await asUser(
      owner,
      "INSERT INTO public.home_items(section,title,property_id) VALUES ('assets','Shared model name',$1)",
      [id],
    );
  }
  const north = locations.rows[0].id;
  const records = await asUser(owner, "SELECT property_id FROM public.passport_records($1)", [
    north,
  ]);
  assert.deepEqual(records.rows, [{ property_id: north }]);
  assert.deepEqual(
    (await asUser(a, "SELECT id FROM public.passport_records($1)", [north])).rows,
    [],
  );
});

test("QA retries isolate fixture emails and recorded outcomes", async () => {
  const executions = ["1", "2", "2"].map((attempt) => createExecutionIdentity("42", attempt));
  const outcomes = ["PASS", "FAIL", "TIMEOUT"];
  for (const [index, { executionId, email }] of executions.entries()) {
    await db.query("INSERT INTO auth.users(id,email) VALUES(gen_random_uuid(),$1)", [email]);
    await db.query(
      "INSERT INTO release_qa_checks(run_id,check_name,outcome) VALUES($1,'checkout',$2)",
      [executionId, outcomes[index]],
    );
  }
  assert.equal(new Set(executions.map((execution) => execution.email)).size, 3);
  for (const [index, { executionId }] of executions.entries()) {
    const result = await db.query("SELECT outcome FROM release_qa_checks WHERE run_id=$1", [
      executionId,
    ]);
    assert.deepEqual(result.rows, [{ outcome: outcomes[index] }]);
  }
});

test("same-tenant AI requests coalesce and cached results require current access", async () => {
  await db.exec("UPDATE runtime_limits SET ai_enabled=true");
  const key = "a".repeat(64),
    lease = crypto.randomUUID(),
    other = crypto.randomUUID();
  const sql = "select public.claim_ai_request($1,$2,null,'capture',$3) as claim";
  const claim = async (id, l) => (await db.query(sql, [key, id, l])).rows[0].claim;
  await assert.rejects(asUser(a, sql, [key, a, lease]), /permission denied/);
  assert.equal((await claim(a, lease)).state, "owner");
  assert.equal((await claim(a, other)).state, "pending");
  await db.query("select public.finish_ai_request($1,$2,$3)", [key, lease, '{"records":[]}']);
  assert.deepEqual((await claim(a, other)).result, { records: [] });
  await assert.rejects(claim(b, other), /scope mismatch/);
  await db.exec("UPDATE runtime_limits SET ai_enabled=false");
  await assert.rejects(claim(a, other), /AI unavailable/);
  await db.exec("UPDATE runtime_limits SET ai_enabled=true");
});
test("usage accounting prices cache reads, writes and audio from current rate rows", async () => {
  const { rows } = await db.query(
    `insert into ai_usage_log(user_id,feature,model,input_tokens,output_tokens,usage_details)
 values($1,'capture','gpt-6-luna',10000,1000,'{"accounting_version":1,"cached_tokens":5000,"cache_write_tokens":2000}') returning cost_usd`,
    [a],
  );
  assert.equal(Number(rows[0].cost_usd), 0.0011);
  const audio = await db.query(
    `insert into ai_usage_log(user_id,feature,model,audio_seconds,usage_details)
 values($1,'speak-transcribe','gpt-transcribe',30,'{"accounting_version":1}') returning cost_usd`,
    [a],
  );
  assert.equal(Number(audio.rows[0].cost_usd), 0.00225);
});
test("settled provider usage releases only its own reservation and records economic cache reuse", async () => {
  await db.exec("UPDATE feature_flags SET enabled=true WHERE key='sera_text'");
  await db.exec(
    "UPDATE runtime_limits SET daily_ai_budget_usd=100,requests_per_minute=60,ai_enabled=true",
  );
  const key = "f".repeat(64),
    lease = crypto.randomUUID();
  await db.query("select claim_ai_request($1,$2,null,'sera',$3)", [key, b, lease]);
  const id = (await db.query("select reserve_ai_operation($1,null,'sera',1,0.02) as id", [b]))
    .rows[0].id;
  await db.query(
    "insert into ai_usage_log(user_id,model,feature,input_tokens,output_tokens,usage_details,reservation_id) values($1,'gpt-6-luna','sera',1000,100,'{\"accounting_version\":1}',$2)",
    [b, id],
  );
  await db.query("select settle_ai_operation($1,$2,2)", [id, b]);
  assert.equal(
    (await db.query("select settled_usd from operation_reservations where id=$1", [id])).rows[0]
      .settled_usd,
    null,
  );
  await db.query("select settle_ai_operation($1,$2,1)", [id, b]);
  assert.equal(
    Number(
      (await db.query("select settled_usd from operation_reservations where id=$1", [id])).rows[0]
        .settled_usd,
    ),
    0.00015,
  );
  await db.query("select finish_metered_request($1,$2,$3,$4)", [key, lease, '{"reply":"ok"}', id]);
  await db.query("select claim_ai_request($1,$2,null,'sera',$3)", [key, b, crypto.randomUUID()]);
  const { rows } = await db.query("select savings_usd from ai_reuse_days where user_id=$1", [b]);
  assert.equal(Number(rows[0].savings_usd), 0.00015);
  await assert.rejects(
    asUser(b, "select ai_cost_summary(now()-interval '1 day',now())"),
    /permission denied/,
  );
});
