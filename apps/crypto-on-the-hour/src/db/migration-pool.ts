/**
 * Migrations only need Postgres — avoid loading app config (REDIS_URL, etc.).
 */
import "dotenv/config";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url?.trim()) {
  throw new Error("Missing required env: DATABASE_URL (set in .env for migrate)");
}

export const migrationPool = new pg.Pool({
  connectionString: url.trim(),
  max: 1,
});
