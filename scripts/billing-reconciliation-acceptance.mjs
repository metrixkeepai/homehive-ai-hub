// Dedicated migrator job. Rehearse the production RPC inside a transaction that always rolls back.
import postgres from "postgres";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const ref = "caqtifaytqukimdkyahv";
assert.equal(process.env.APP_ENV, "production");
assert.equal(process.env.EXPECTED_SUPABASE_REF, ref);
const url = new URL(process.env.DATABASE_MIGRATION_URL);
assert(
  url.hostname === "db." + ref + ".supabase.co" ||
    (url.hostname.endsWith(".pooler.supabase.com") &&
      url.username === "postgres." + ref &&
      ["", "5432"].includes(url.port)),
);
const db = postgres(url.href, { max: 1, ssl: "require", connect_timeout: 10 });
const rollback = new Error("rollback rehearsal");
const id = randomUUID();
try {
  try {
    await db.begin(async (sql) => {
      await sql`set local lock_timeout = '2s'`;
      await sql`set local statement_timeout = '5s'`;
      // No other transaction can observe this uncommitted setting or the synthetic identity.
      const rows = await sql`update public.runtime_limits set billing_environment='live'
        where singleton and billing_environment='disabled' returning singleton`;
      assert.equal(rows.length, 1);
      await sql`insert into auth.users(id,email,raw_user_meta_data) values (${id},${id + "@example.invalid"},'{}')`;
      const customer = "acceptance_cus_" + id;
      await sql`insert into public.billing_customers(user_id,environment,customer_id) values (${id}, 'live', ${customer})`;
      const sub = {
        id: "acceptance_sub_" + id,
        customer,
        product: "acceptance_product",
        price: "acceptance_price",
        status: "active",
        interval: "month",
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 86400000).toISOString(),
        cancel_at_period_end: false,
      };
      const apply = () =>
        sql`select public.apply_billing_event(${"acceptance_evt_" + id},1::bigint,'live',${sql.json(sub)}::jsonb,'home',true) as changed`;
      assert.equal((await apply())[0].changed, true);
      assert.equal((await apply())[0].changed, false);
      assert.equal((await sql`select plan from public.profiles where id=${id}`)[0].plan, "home");
      assert.equal(
        (await sql`select stripe_customer_id from public.subscriptions where user_id=${id}`)[0]
          .stripe_customer_id,
        customer,
      );
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.equal(
    (await db`select billing_environment from public.runtime_limits where singleton`)[0]
      .billing_environment,
    "disabled",
  );
  assert.equal((await db`select id from auth.users where id=${id}`).length, 0);
  console.info("Production reconciliation, duplicate suppression and rollback verified");
} catch (error) {
  console.error(
    "Production reconciliation rehearsal failed",
    /^[A-Z0-9_]{1,24}$/.test(error?.code ?? "") ? error.code : "",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
