/**
 * Validates optional JSON env and prompt file paths before deploy.
 * Does not import full app config (no DATABASE_URL / REDIS_URL required).
 */
import "dotenv/config";
import { existsSync } from "node:fs";

function ok(msg: string): void {
  console.info(`[verify-pipeline] ${msg}`);
}

function fail(msg: string): never {
  console.error(`[verify-pipeline] ${msg}`);
  process.exit(1);
}

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function parseJsonOptional(name: string, raw: string): void {
  if (!raw) return;
  try {
    JSON.parse(raw);
    ok(`${name}: valid JSON`);
  } catch {
    fail(`${name} must be valid JSON`);
  }
}

parseJsonOptional("RSS_FEEDS_JSON", env("RSS_FEEDS_JSON"));
parseJsonOptional("TOPIC_RANK_KEYWORDS_JSON", env("TOPIC_RANK_KEYWORDS_JSON"));
parseJsonOptional("MENTIONED_ASSETS_JSON", env("MENTIONED_ASSETS_JSON"));

const promptFile = env("ARTICLE_SYSTEM_PROMPT_FILE");
if (promptFile && !existsSync(promptFile)) {
  fail(`ARTICLE_SYSTEM_PROMPT_FILE not found: ${promptFile}`);
}
if (promptFile) ok(`ARTICLE_SYSTEM_PROMPT_FILE: exists (${promptFile})`);

ok("Optional JSON / prompt file checks passed (see docs/rss-article-pipeline.md)");
