import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  for (const name of [
    "001_init.sql",
    "002_seed_rss.sql",
    "003_topics_mentioned_assets.sql",
    "004_web_published_articles.sql",
  ]) {
    const sqlPath = join(__dirname, "../../migrations", name);
    const sql = readFileSync(sqlPath, "utf8");
    await pool.query(sql);
    console.log("Migration applied:", name);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
