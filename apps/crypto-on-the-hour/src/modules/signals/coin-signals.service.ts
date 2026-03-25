/**
 * Coin-scoped signals: topics, mentions, sentiment, scores (Crypto On the Hour DB).
 */
import { query } from "../../db/pool.js";
import { expandSymbolForFilter } from "../topics/topic-assets.js";

export type CoinSignalsTopic = {
  id: string;
  slug: string;
  headline: string;
  rankScore: number;
  score100: number;
  articleCount: number;
  mentionedAssets: string[];
  lastUpdatedAt: string;
  /** UTC hour bucket (unix sec) for /crypto-on-the-hour/:timestamp */
  reportHourUnix: number;
};

export type CoinSignalMention = {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  topicId: string;
};

export type CoinSignalsResponse = {
  symbol: string;
  sentiment: "bullish" | "bearish" | "neutral";
  sentimentScore: number;
  /** 0–1 aggregate from topic scores */
  aggregateScore: number;
  topics: CoinSignalsTopic[];
  mentions: CoinSignalMention[];
  relatedCoins: string[];
  latestPipelineHourUnix: number | null;
};

const POS = ["surge", "rally", "approval", "bullish", "soar", "gain", "record", "upgrade", "growth"];
const NEG = ["crash", "hack", "exploit", "ban", "lawsuit", "bearish", "plunge", "selloff", "fraud", "warning"];

function hourBucketUnix(iso: Date): number {
  const d = new Date(iso);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCSeconds(0, 0);
  return Math.floor(d.getTime() / 1000);
}

function sentimentFromHeadlines(headlines: string[]): { label: "bullish" | "bearish" | "neutral"; score: number } {
  let pos = 0;
  let neg = 0;
  const h = headlines.join(" ").toLowerCase();
  for (const w of POS) if (h.includes(w)) pos += 1;
  for (const w of NEG) if (h.includes(w)) neg += 1;
  if (pos === 0 && neg === 0) return { label: "neutral", score: 0.5 };
  const net = (pos - neg) / (pos + neg + 0.5);
  const score = (net + 1) / 2;
  if (net > 0.15) return { label: "bullish", score };
  if (net < -0.15) return { label: "bearish", score };
  return { label: "neutral", score };
}

function rankToScore100(rankScore: number, maxRank: number): number {
  if (maxRank <= 0) return 0;
  const n = Math.min(1, Math.max(0, rankScore / maxRank));
  return Math.round(n * 1000) / 10;
}

export async function getCoinSignals(rawSymbol: string): Promise<CoinSignalsResponse> {
  const symbol = rawSymbol.trim().toUpperCase();
  const variants = expandSymbolForFilter(symbol);

  const topicsRes = await query<{
    id: string;
    slug: string;
    headline: string;
    rank_score: string;
    article_count: number;
    mentioned_assets: string[] | null;
    last_updated_at: Date;
  }>(
    `SELECT t.id, t.slug, t.headline, t.rank_score::text, t.article_count,
            t.mentioned_assets, t.last_updated_at
     FROM topics t
     WHERE t.status = 'active'
       AND cardinality(t.mentioned_assets) > 0
       AND t.mentioned_assets && $1::text[]
     ORDER BY t.rank_score DESC, t.last_updated_at DESC
     LIMIT 12`,
    [variants]
  );

  const rows = topicsRes.rows;
  const maxRank = rows.reduce((m, r) => Math.max(m, parseFloat(r.rank_score) || 0), 0) || 1;

  const topics: CoinSignalsTopic[] = rows.map((r) => {
    const rankScore = parseFloat(r.rank_score) || 0;
    const lu = r.last_updated_at instanceof Date ? r.last_updated_at : new Date(r.last_updated_at);
    return {
      id: r.id,
      slug: r.slug,
      headline: r.headline,
      rankScore,
      score100: rankToScore100(rankScore, maxRank),
      articleCount: r.article_count,
      mentionedAssets: r.mentioned_assets ?? [],
      lastUpdatedAt: lu.toISOString(),
      reportHourUnix: hourBucketUnix(lu),
    };
  });

  const topicIds = topics.map((t) => t.id);
  let mentions: CoinSignalMention[] = [];

  if (topicIds.length) {
    const men = await query<{
      title: string;
      link: string;
      source: string;
      published_at: Date | null;
      topic_id: string;
    }>(
      `SELECT ra.title, ra.link, rs.name AS source, ra.published_at, ta.topic_id
       FROM topic_articles ta
       JOIN raw_articles ra ON ra.id = ta.article_id
       JOIN rss_sources rs ON rs.id = ra.source_id
       WHERE ta.topic_id = ANY ($1::uuid[])
       ORDER BY ra.published_at DESC NULLS LAST
       LIMIT 20`,
      [topicIds]
    );
    mentions = men.rows.map((r) => ({
      title: r.title,
      link: r.link,
      source: r.source,
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null,
      topicId: r.topic_id,
    }));
  }

  const sent = sentimentFromHeadlines([...topics.map((t) => t.headline), ...mentions.map((m) => m.title)]);

  const agg =
    topics.length > 0
      ? topics.reduce((s, t) => s + t.score100, 0) / topics.length / 100
      : 0.5;

  const exclude = new Set(variants.map((v) => v.toUpperCase()));
  exclude.add(symbol);
  const related = new Set<string>();
  for (const t of topics) {
    for (const a of t.mentionedAssets) {
      const u = a.toUpperCase();
      if (!exclude.has(u)) related.add(u);
    }
  }
  const relatedCoins = [...related].slice(0, 8);

  const pipe = await query<{ started_at: Date }>(
    `SELECT started_at FROM pipeline_runs WHERE status = 'ok' ORDER BY started_at DESC LIMIT 1`
  );
  const latestPipelineHourUnix = pipe.rows[0]?.started_at
    ? hourBucketUnix(
        pipe.rows[0].started_at instanceof Date
          ? pipe.rows[0].started_at
          : new Date(pipe.rows[0].started_at)
      )
    : null;

  return {
    symbol,
    sentiment: sent.label,
    sentimentScore: Math.round(sent.score * 1000) / 1000,
    aggregateScore: Math.round(agg * 1000) / 1000,
    topics: topics.slice(0, 8),
    mentions: mentions.slice(0, 12),
    relatedCoins,
    latestPipelineHourUnix,
  };
}

export type HourBucketResponse = {
  hourStartUnix: number;
  hourEndUnix: number;
  topics: {
    id: string;
    slug: string;
    headline: string;
    rankScore: number;
    mentionedAssets: string[];
    lastUpdatedAt: string;
  }[];
};

export async function getTopicsForHourBucket(hourStartUnix: number): Promise<HourBucketResponse | null> {
  if (!Number.isFinite(hourStartUnix)) return null;
  const start = new Date(hourStartUnix * 1000);
  const end = new Date(start.getTime() + 3600_000);

  const r = await query<{
    id: string;
    slug: string;
    headline: string;
    rank_score: string;
    mentioned_assets: string[] | null;
    last_updated_at: Date;
  }>(
    `SELECT id, slug, headline, rank_score::text, mentioned_assets, last_updated_at
     FROM topics
     WHERE last_updated_at >= $1 AND last_updated_at < $2 AND status = 'active'
     ORDER BY rank_score DESC, last_updated_at DESC
     LIMIT 60`,
    [start.toISOString(), end.toISOString()]
  );

  return {
    hourStartUnix,
    hourEndUnix: Math.floor(end.getTime() / 1000),
    topics: r.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      headline: row.headline,
      rankScore: parseFloat(row.rank_score) || 0,
      mentionedAssets: row.mentioned_assets ?? [],
      lastUpdatedAt:
        row.last_updated_at instanceof Date
          ? row.last_updated_at.toISOString()
          : new Date(row.last_updated_at).toISOString(),
    })),
  };
}
