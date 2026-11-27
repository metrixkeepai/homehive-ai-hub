import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { createHash } from "node:crypto";
if (!process.env.DATABASE_MIGRATION_URL || !["staging", "production"].includes(process.env.APP_ENV))
  throw new Error("Set DATABASE_MIGRATION_URL and an explicit APP_ENV in the correct environment.");
if (process.env.EXPECTED_SUPABASE_REF) {
  const target = new URL(process.env.DATABASE_MIGRATION_URL);
  const expected = process.env.EXPECTED_SUPABASE_REF;
  const direct = target.hostname === `db.${expected}.supabase.co`;
  const pooled =
    target.hostname.endsWith(".pooler.supabase.com") &&
    target.username === `postgres.${expected}` &&
    ["", "5432"].includes(target.port);
  if (
    (!direct && !pooled) ||
    (process.env.APP_ENV === "staging") !== (expected === "cdfpupivjjamhvmfcvry")
  )
    throw new Error("Unexpected migration target for this environment");
}
const sql = postgres(process.env.DATABASE_MIGRATION_URL, {
  max: 1,
  connect_timeout: 10,
  ssl: "require",
});
try {
  await sql`SELECT pg_advisory_lock(8102027)`;
  const [existing] =
    await sql`SELECT to_regclass('public.profiles') IS NOT NULL AS profiles, to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS tracked`;
  if (existing.profiles && !existing.tracked)
    throw new Error("Existing untracked schema: reconcile migration history before applying.");
  const config = { migrationsFolder: "drizzle/migrations" };
  let migrations = readMigrationFiles(config);
  if (existing.tracked) {
    // The Cloud Run release shipped these definitions in its original 48 files.
    // Main restored the same features later in 0048–0055. Replaying those files
    // against the deployed lineage attempts to recreate existing tables/functions.
    const rows = await sql`select created_at,hash from drizzle.__drizzle_migrations
      where created_at <= 1795689602000 order by created_at`;
    const signature = createHash("sha256")
      .update(rows.map((row) => row.created_at + ":" + row.hash).join(","))
      .digest("hex");
    if (signature === "dcc9add4e51970a523e511643fd105b3458fc0785f1677330222a124307ac892") {
      migrations = migrations.filter(
        (m) => m.folderMillis <= 1795689602000 || m.folderMillis > 1795785231175,
      );
    }
  }
  const db = drizzle(sql);
  await db.dialect.migrate(migrations, db.session, config);
  console.info(JSON.stringify({ event: "migrations_applied", environment: process.env.APP_ENV }));
} catch (error) {
  console.error(
    JSON.stringify({
      event: "migration_failed",
      environment: process.env.APP_ENV,
      code:
        typeof error?.code === "string" && /^[A-Z0-9_]{2,24}$/.test(error.code)
          ? error.code
          : "MIGRATION_ERROR",
    }),
  );
  console.error(
    "Migration failed. Check target schema and database administration logs; no deployment was started.",
  );
  process.exitCode = 1;
} finally {
  try {
    await sql`SELECT pg_advisory_unlock(8102027)`;
  } catch {
    /* connection may already be closed */
  }
  await sql.end({ timeout: 5 });
}
