/**
 * RSS ingestion — pluggable; future sources (Twitter, on-chain) implement IngestionSource.
 */
import crypto from "node:crypto";
import Parser from "rss-parser";
import { config } from "../../config.js";
import { query } from "../../db/pool.js";
import type { RawArticle, RssSource } from "../../types/domain.js";
import type { IngestionSource, IngestedItem } from "./ingestion-source.js";
import { syncRssFeedsFromEnvIfConfigured } from "./rss-feeds-env-sync.js";

function createRssParser(): Parser {
  return new Parser({
    timeout: 20_000,
    headers: { "User-Agent": config.rssUserAgent },
  });
}

export type { IngestionSource };

export function normalizedHash(link: string, title: string): string {
  const norm = `${link.trim().toLowerCase()}|${title.trim().toLowerCase().replace(/\s+/g, " ")}`;
  return crypto.createHash("sha256").update(norm).digest("hex");
}

export async function listActiveRssSources(): Promise<RssSource[]> {
  const r = await query<RssSource>(
    `SELECT id, name, feed_url, weight::float, is_active FROM rss_sources WHERE is_active = TRUE`
  );
  return r.rows;
}

export async function upsertRawArticle(
  sourceId: string,
  item: {
    title: string;
    link: string;
    summary?: string | null;
    published_at?: Date | null;
  }
): Promise<{ inserted: boolean; id?: string }> {
  const contentHash = normalizedHash(item.link, item.title);
  try {
    const ins = await query<{ id: string }>(
      `INSERT INTO raw_articles (source_id, title, link, summary, published_at, content_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (content_hash) DO NOTHING
       RETURNING id`,
      [sourceId, item.title, item.link, item.summary ?? null, item.published_at ?? null, contentHash]
    );
    if (ins.rowCount === 0) return { inserted: false };
    return { inserted: true, id: ins.rows[0]?.id };
  } catch (e) {
    console.error("[rss] upsert error", e);
    return { inserted: false };
  }
}

export class RssFeedIngestor implements IngestionSource {
  constructor(
    private source: RssSource,
    private parserInstance: Parser = createRssParser()
  ) {}

  get name(): string {
    return this.source.name;
  }

  async fetchArticles(): Promise<IngestedItem[]> {
    const feed = await this.parserInstance.parseURL(this.source.feed_url);
    const out: Pick<RawArticle, "title" | "link" | "summary" | "published_at">[] = [];
    for (const item of feed.items ?? []) {
      if (!item.title || !item.link) continue;
      const pub = item.pubDate ? new Date(item.pubDate) : item.isoDate ? new Date(item.isoDate) : null;
      out.push({
        title: item.title.trim(),
        link: item.link.trim(),
        summary: item.contentSnippet?.slice(0, 2000) ?? item.summary?.slice(0, 2000) ?? null,
        published_at: pub && !Number.isNaN(pub.getTime()) ? pub : null,
      });
    }
    return out;
  }
}

/** Ingest all active RSS feeds and return counts. */
export async function ingestAllRssFeeds(): Promise<{ fetched: number; inserted: number }> {
  await syncRssFeedsFromEnvIfConfigured();
  const sources = await listActiveRssSources();
  const rssParser = createRssParser();
  let fetched = 0;
  let inserted = 0;
  for (const src of sources) {
    const ingestor = new RssFeedIngestor(src, rssParser);
    const items = await ingestor.fetchArticles();
    fetched += items.length;
    for (const it of items) {
      const r = await upsertRawArticle(src.id, it);
      if (r.inserted) inserted += 1;
    }
  }
  return { fetched, inserted };
}
