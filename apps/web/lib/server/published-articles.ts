import type { Pool } from "pg";

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
  return r.rows;
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
  return r.rows[0] ?? null;
}
