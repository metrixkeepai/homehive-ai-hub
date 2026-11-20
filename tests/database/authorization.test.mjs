import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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
  await db.exec("UPDATE public.runtime_limits SET daily_ai_budget_usd=5");
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
