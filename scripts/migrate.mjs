import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
if (!process.env.DATABASE_MIGRATION_URL || !["staging", "production"].includes(process.env.APP_ENV))
  throw new Error("Set DATABASE_MIGRATION_URL and an explicit APP_ENV in the correct environment.");
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
  await migrate(drizzle(sql), { migrationsFolder: "drizzle/migrations" });
  console.info(JSON.stringify({ event: "migrations_applied", environment: process.env.APP_ENV }));
} catch (error) {
  console.error(
    JSON.stringify({
      event: "migration_failed",
      environment: process.env.APP_ENV,
      message: error instanceof Error ? error.message : String(error),
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
