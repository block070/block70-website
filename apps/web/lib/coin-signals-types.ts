/** Response shape from GET /api/coin-signals/:symbol (mirrors crypto-on-the-hour /signals/coin). */

export type CoinSignalsTopic = {
  id: string;
  slug: string;
  headline: string;
  rankScore: number;
  score100: number;
  articleCount: number;
  mentionedAssets: string[];
  lastUpdatedAt: string;
  reportHourUnix: number;
};

export type CoinSignalMention = {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  topicId: string;
};

export type CoinSignalsPayload = {
  symbol: string;
  sentiment: "bullish" | "bearish" | "neutral";
  sentimentScore: number;
  aggregateScore: number;
  topics: CoinSignalsTopic[];
  mentions: CoinSignalMention[];
  relatedCoins: string[];
  latestPipelineHourUnix: number | null;
  /** Present when Block70 returned a stub (upstream unavailable) */
  source?: "live" | "empty";
};

export type HourSnapshotPayload = {
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
