/**
 * Optional env-driven RSS sources — same shape as FastAPI NEWS_FEEDS_JSON:
 * [{"source":"Site Name","url":"https://.../feed"}, ...]
 * Upserts into rss_sources so per-project deploys can skip manual DB seeds.
 */
import { query } from "../../db/pool.js";
import { config } from "../../config.js";

export async function syncRssFeedsFromEnvIfConfigured(): Promise<number> {
  const raw = config.rssFeedsJson;
  if (!raw) return 0;

  let items: unknown[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn("[rss-sync] RSS_FEEDS_JSON is not valid JSON; skipping sync");
    return 0;
  }

  let n = 0;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const url = typeof rec.url === "string" ? rec.url.trim() : "";
    const source = typeof rec.source === "string" && rec.source.trim() ? rec.source.trim() : "RSS";
    if (!url) continue;

    await query(
      `INSERT INTO rss_sources (name, feed_url, weight, is_active)
       VALUES ($1, $2, 1.0, TRUE)
       ON CONFLICT (feed_url) DO UPDATE SET
         name = EXCLUDED.name,
         is_active = TRUE,
         updated_at = now()`,
      [source, url],
    );
    n += 1;
  }

  if (n > 0) {
    console.info("[rss-sync] upserted rss_sources from RSS_FEEDS_JSON", { count: n });
  }
  return n;
}
