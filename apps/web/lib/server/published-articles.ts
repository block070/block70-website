import type { Pool } from "pg";

import {
  CRYPTO_ON_THE_HOUR_BASE as COH_BASE,
  cryptoHourArticlePath as articlePath,
} from "@/lib/crypto-hour-url";

export type PublishedArticleRow = {
  topic_id: string;
  topic_slug: string;
  title: string;
  body_markdown: string;
  meta: Record<string, unknown>;
  updated_at: Date;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/** Re-export for legacy imports — prefer `@/lib/crypto-hour-url`. */
export const CRYPTO_ON_THE_HOUR_BASE = COH_BASE;

/** URL for one article (`/crypto-on-the-hour/:slug`). */
export function cryptoHourArticlePath(topicSlug: string): string {
  return articlePath(topicSlug);
}

function coerceMeta(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

/** JSONB/text columns may be null; null `meta` used to crash the article page (Next "digest" noise). */
function normalizeRow(row: PublishedArticleRow): PublishedArticleRow {
  return {
    topic_id: String(row.topic_id ?? ""),
    topic_slug: String(row.topic_slug ?? ""),
    title: String(row.title ?? ""),
    body_markdown: String(row.body_markdown ?? ""),
    meta: coerceMeta(row.meta as unknown),
    updated_at:
      row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at ?? 0)),
  };
}

export async function listPublishedArticles(
  pool: Pool,
  limit = 50,
): Promise<PublishedArticleRow[]> {
  const r = await pool.query<PublishedArticleRow>(
    `SELECT topic_id, topic_slug, title, body_markdown, meta, updated_at
     FROM web_published_articles
     ORDER BY updated_at DESC
     LIMIT $1`,
    [limit]
  );
  return r.rows.map(normalizeRow);
}

/** Articles whose `updated_at` falls in [start, end) (typically UTC from Chicago hour bounds). */
export async function listPublishedArticlesInRange(
  pool: Pool,
  start: Date,
  end: Date,
  limit = 200,
): Promise<PublishedArticleRow[]> {
  const r = await pool.query<PublishedArticleRow>(
    `SELECT topic_id, topic_slug, title, body_markdown, meta, updated_at
     FROM web_published_articles
     WHERE updated_at >= $1 AND updated_at < $2
     ORDER BY updated_at DESC
     LIMIT $3`,
    [start.toISOString(), end.toISOString(), limit]
  );
  return r.rows.map(normalizeRow);
}

export async function getPublishedArticleByTopicId(
  pool: Pool,
  topicId: string,
): Promise<PublishedArticleRow | null> {
  const r = await pool.query<PublishedArticleRow>(
    `SELECT topic_id, topic_slug, title, body_markdown, meta, updated_at
     FROM web_published_articles
     WHERE topic_id = $1`,
    [topicId]
  );
  const row = r.rows[0];
  return row ? normalizeRow(row) : null;
}

/** `topic_slug` is not UNIQUE; if duplicates exist, return the latest row. */
export async function getPublishedArticleBySlug(
  pool: Pool,
  topicSlug: string,
): Promise<PublishedArticleRow | null> {
  const r = await pool.query<PublishedArticleRow>(
    `SELECT topic_id, topic_slug, title, body_markdown, meta, updated_at
     FROM web_published_articles
     WHERE topic_slug = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [topicSlug]
  );
  const row = r.rows[0];
  return row ? normalizeRow(row) : null;
}
