import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrationPool } from "./migration-pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATION_FILES = [
  "001_init.sql",
  "002_seed_rss.sql",
  "003_topics_mentioned_assets.sql",
  "004_web_published_articles.sql",
  "005_crypto_hour_x_posts.sql",
] as const;

/** Migrations that existed before we tracked names — mark applied if DB already initialized. */
const ASSUME_APPLIED_IF_LEGACY_DB = [
  "001_init.sql",
  "002_seed_rss.sql",
  "003_topics_mentioned_assets.sql",
  "004_web_published_articles.sql",
] as const;

async function ensureMigrationsTable() {
  await migrationPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Old workflow re-ran 001 on every `db:migrate`, which breaks existing DBs. If we see core
 * tables but an empty tracking table, assume 001-004 were applied and only run new files.
 */
async function backfillMigrationTrackingForLegacyDb() {
  const count = await migrationPool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM schema_migrations`
  );
  if (parseInt(count.rows[0]?.n ?? "1", 10) > 0) return;

  const exists = await migrationPool.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'rss_sources'
     ) AS ok`
  );
  if (!exists.rows[0]?.ok) return;

  for (const name of ASSUME_APPLIED_IF_LEGACY_DB) {
    await migrationPool.query(`INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`, [
      name,
    ]);
  }
  console.log(
    "Existing database detected (no schema_migrations yet). Marked 001-004 as already applied; pending files will run next."
  );
}

async function main() {
  await ensureMigrationsTable();
  await backfillMigrationTrackingForLegacyDb();

  for (const name of MIGRATION_FILES) {
    const applied = await migrationPool.query(`SELECT 1 FROM schema_migrations WHERE name = $1`, [name]);
    if (applied.rowCount && applied.rowCount > 0) {
      console.log("Migration skipped (already applied):", name);
      continue;
    }
    const sqlPath = join(__dirname, "../../migrations", name);
    const sql = readFileSync(sqlPath, "utf8");
    await migrationPool.query(sql);
    await migrationPool.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [name]);
    console.log("Migration applied:", name);
  }
  await migrationPool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
