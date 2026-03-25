/**
 * Topic ranking — heuristic scores; swap for ML / engagement signals later.
 */
import { query } from "../../db/pool.js";
import { config } from "../../config.js";

const KEYWORDS = new Map<string, number>([
  ["etf", 2],
  ["sec", 2],
  ["regulation", 1.5],
  ["bitcoin", 1.2],
  ["ethereum", 1.2],
  ["hack", 2],
  ["exploit", 2],
  ["binance", 1.2],
  ["coinbase", 1.2],
  ["fed", 1.3],
  ["rate", 1],
  ["launch", 1],
  ["mainnet", 1.2],
]);

function keywordBoost(headline: string): number {
  const h = headline.toLowerCase();
  let s = 0;
  for (const [k, w] of KEYWORDS) if (h.includes(k)) s += w;
  return s;
}

/** Hours since t; fresher = higher */
function recencyScore(t: Date | null): number {
  if (!t || Number.isNaN(t.getTime())) return 1;
  const hours = (Date.now() - t.getTime()) / 3_600_000;
  return Math.max(0, 10 - Math.min(hours, 72) / 12);
}

export async function rankTopics(): Promise<{ updated: number }> {
  const topics = await query<{
    id: string;
    headline: string;
    last_updated_at: Date;
    article_count: number;
  }>(
    `SELECT t.id, t.headline, t.last_updated_at, t.article_count
     FROM topics t
     WHERE t.status = 'active'
       AND t.last_updated_at > now() - $1::int * interval '1 hour'
       AND NOT EXISTS (
         SELECT 1 FROM content_pieces c WHERE c.topic_id = t.id AND c.kind = 'seo_article'
       )`,
    [config.topicLookbackHours * 2]
  );

  let updated = 0;
  for (const t of topics.rows) {
    const kw = keywordBoost(t.headline);
    const rec = recencyScore(t.last_updated_at);
    const breadth = Math.log2(2 + t.article_count);
    const score = 2 + kw + rec + breadth;
    await query(`UPDATE topics SET rank_score = $2 WHERE id = $1`, [t.id, score]);
    updated += 1;
  }
  return { updated };
}

export async function listTopTopicsForGeneration(limit = 5): Promise<
  {
    id: string;
    headline: string;
    summary: string | null;
    rank_score: number;
    bullets: string[];
  }[]
> {
  const min = config.minTopicScoreToGenerate;
  const r = await query<{
    id: string;
    headline: string;
    summary: string | null;
    rank_score: number;
  }>(
    `SELECT id, headline, summary, rank_score::float
     FROM topics
     WHERE status = 'active' AND rank_score >= $1
       AND NOT EXISTS (SELECT 1 FROM content_pieces c WHERE c.topic_id = topics.id AND c.kind = 'seo_article')
     ORDER BY rank_score DESC, last_updated_at DESC
     LIMIT $2`,
    [min, limit]
  );

  const out: {
    id: string;
    headline: string;
    summary: string | null;
    rank_score: number;
    bullets: string[];
  }[] = [];

  for (const row of r.rows) {
    const arts = await query<{ title: string; link: string }>(
      `SELECT ra.title, ra.link FROM topic_articles ta
       JOIN raw_articles ra ON ra.id = ta.article_id
       WHERE ta.topic_id = $1
       ORDER BY ra.published_at DESC NULLS LAST
       LIMIT 8`,
      [row.id]
    );
    out.push({
      ...row,
      bullets: arts.rows.map((a) => `${a.title} (${a.link})`),
    });
  }
  return out;
}
