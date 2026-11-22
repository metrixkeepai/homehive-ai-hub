// Staging fallback for projects where Cloud Scheduler cannot be provisioned.
import postgres from "postgres";
const env = process.env;
const target = new URL(env.DATABASE_MIGRATION_URL),
  ref = "cdfpupivjjamhvmfcvry";
if (
  env.APP_ENV !== "staging" ||
  !(
    target.hostname === "db." + ref + ".supabase.co" ||
    (target.hostname.endsWith(".pooler.supabase.com") && target.username === "postgres." + ref)
  ) ||
  !/^https:\/\/qa-\d+-\d+---matrixkeep-staging-web-msp44mt5hq-nw\.a\.run\.app$/.test(
    env.CONNECTOR_CANDIDATE,
  )
)
  throw Error("Unexpected staging target");
const sql = postgres(env.DATABASE_MIGRATION_URL, { max: 1, ssl: "require", connect_timeout: 10 });
try {
  await sql.begin(async (tx) => {
    await tx.unsafe("CREATE EXTENSION IF NOT EXISTS pg_cron");
    await tx.unsafe("CREATE EXTENSION IF NOT EXISTS pg_net");
    await tx`select cron.schedule('matrixkeep-connector-retention','17 2 * * *','select public.purge_expired_connector_data()')`;
    const endpoint = env.CONNECTOR_CANDIDATE + "/api/internal/connector-tick";
    // Endpoint is restricted to the exact staging project hostname above.
    const command = `DO $tick$ DECLARE token text:=gen_random_uuid()::text||gen_random_uuid()::text; BEGIN
 DELETE FROM public.connector_scheduler_ticks WHERE expires_at<=now();
 IF EXISTS(SELECT FROM public.connector_checks k JOIN public.app_user_connections c ON c.user_id=k.user_id AND c.connector_id=k.provider WHERE (k.requested OR k.auto_check) AND NOT c.reconnect_required) THEN
 INSERT INTO public.connector_scheduler_ticks VALUES(sha256(convert_to(token,'UTF8')),now()+interval '5 minutes');
 PERFORM net.http_post(url:='${endpoint}',headers:=jsonb_build_object('Authorization','Bearer '||token),body:='{}'::jsonb,timeout_milliseconds:=25000);
 END IF;END $tick$`;
    await tx`select cron.schedule('matrixkeep-connector-review','0 9 1,15 * *',${command})`;
    const rows =
      await tx`select active,schedule from cron.job where jobname='matrixkeep-connector-review'`;
    if (rows.length !== 1 || !rows[0].active || rows[0].schedule !== "0 9 1,15 * *")
      throw Error("Schedule verification failed");
  });
  console.log("Verified twice-monthly staging connector schedule in PostgreSQL.");
} finally {
  await sql.end();
}
