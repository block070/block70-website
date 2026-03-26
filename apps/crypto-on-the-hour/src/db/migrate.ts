import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrationPool } from "./migration-pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  for (const name of [
    "001_init.sql",
    "002_seed_rss.sql",
    "003_topics_mentioned_assets.sql",
    "004_web_published_articles.sql",
    "005_crypto_hour_x_posts.sql",
  ]) {
    const sqlPath = join(__dirname, "../../migrations", name);
    const sql = readFileSync(sqlPath, "utf8");
    await migrationPool.query(sql);
    console.log("Migration applied:", name);
  }
  await migrationPool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
