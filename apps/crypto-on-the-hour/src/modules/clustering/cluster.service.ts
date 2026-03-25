/**
 * Content clustering + deduplication.
 * v1: token Jaccard similarity on titles within lookback window.
 */
import { createHash } from "node:crypto";
import { query } from "../../db/pool.js";
import { config } from "../../config.js";

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

const STOP = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "was",
  "one",
  "our",
  "out",
  "new",
  "now",
  "how",
  "may",
  "its",
  "who",
]);

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function slugify(headline: string): string {
  const base = headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const hash = createHash("sha256").update(headline).digest("hex").slice(0, 8);
  return `${base || "topic"}-${hash}`;
}

const SIMILARITY_THRESHOLD = 0.35;

export type ClusterInputArticle = {
  id: string;
  title: string;
  summary: string | null;
  link: string;
  published_at: Date | null;
  source_weight: number;
};

type TopicMem = { id: string; slug: string; headline: string; tokens: Set<string> };

export async function loadRecentArticlesForClustering(): Promise<ClusterInputArticle[]> {
  const r = await query<ClusterInputArticle>(
    `SELECT ra.id, ra.title, ra.summary, ra.link, ra.published_at, rs.weight::float AS source_weight
     FROM raw_articles ra
     JOIN rss_sources rs ON rs.id = ra.source_id
     WHERE ra.fetched_at > now() - $1::int * interval '1 hour'
     ORDER BY ra.published_at DESC NULLS LAST, ra.fetched_at DESC
     LIMIT 500`,
    [config.topicLookbackHours]
  );
  return r.rows;
}

export async function clusterRecentArticles(): Promise<{ topicsCreated: number; linksAdded: number }> {
  const articles = await loadRecentArticlesForClustering();
  if (articles.length === 0) return { topicsCreated: 0, linksAdded: 0 };

  const memoryTopics: TopicMem[] = [];
  const loaded = await query<{ id: string; slug: string; headline: string }>(
    `SELECT id, slug, headline FROM topics
     WHERE status = 'active' AND last_updated_at > now() - $1::int * interval '1 hour'`,
    [config.topicLookbackHours * 2]
  );
  for (const row of loaded.rows) {
    memoryTopics.push({ id: row.id, slug: row.slug, headline: row.headline, tokens: tokenize(row.headline) });
  }

  const findTopic = (tokens: Set<string>): TopicMem | null => {
    let best: TopicMem | null = null;
    let bestScore = 0;
    for (const t of memoryTopics) {
      const sim = jaccard(tokens, t.tokens);
      if (sim >= SIMILARITY_THRESHOLD && sim > bestScore) {
        bestScore = sim;
        best = t;
      }
    }
    return best;
  };

  let topicsCreated = 0;
  let linksAdded = 0;

  for (const a of articles) {
    const tokens = tokenize(a.title);
    let mem = findTopic(tokens);
    if (!mem) {
      const headline = a.title;
      const slug = slugify(headline);
      let ins = await query<{ id: string }>(
        `INSERT INTO topics (slug, headline, summary, article_count, rank_score)
         VALUES ($1, $2, $3, 0, 0)
         ON CONFLICT (slug) DO NOTHING
         RETURNING id`,
        [slug, headline, a.summary?.slice(0, 2000) ?? null]
      );
      let id = ins.rows[0]?.id;
      let created = Boolean(id);
      if (!id) {
        const ex = await query<{ id: string }>(`SELECT id FROM topics WHERE slug = $1`, [slug]);
        id = ex.rows[0]!.id;
      }
      if (created) topicsCreated += 1;
      mem = { id: id!, slug, headline, tokens };
      memoryTopics.push(mem);
    }

    const link = await query(
      `INSERT INTO topic_articles (topic_id, article_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [mem.id, a.id]
    );
    if (link.rowCount) linksAdded += link.rowCount;
  }

  await query(
    `UPDATE topics t SET
       article_count = (SELECT count(*)::int FROM topic_articles ta WHERE ta.topic_id = t.id),
       summary = COALESCE(
         (SELECT ra.summary FROM topic_articles ta
          JOIN raw_articles ra ON ra.id = ta.article_id
          WHERE ta.topic_id = t.id AND ra.summary IS NOT NULL
          ORDER BY ra.published_at DESC NULLS LAST LIMIT 1),
         t.summary
       ),
       last_updated_at = now()
     WHERE EXISTS (SELECT 1 FROM topic_articles ta WHERE ta.topic_id = t.id)`
  );

  return { topicsCreated, linksAdded };
}
