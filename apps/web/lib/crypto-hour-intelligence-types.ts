/**
 * Hourly intelligence payload (JSON). Stored/computed per Chicago wall-clock hour.
 *
 * @example Schema (JSON):
 * ```json
 * {
 *   "version": 1,
 *   "zone": "America/Chicago",
 *   "hourStartIso": "2026-03-25T19:00:00.000Z",
 *   "hourEndIso": "2026-03-25T20:00:00.000Z",
 *   "keywords": [{ "term": "bitcoin", "count": 12, "sentiment": 18.5, "categoryHint": "macro" }],
 *   "entities": { "coins": ["BTC"], "organizations": ["Coinbase"], "people": [] },
 *   "hourSentiment": 12.3,
 *   "categories": [{ "id": "regulation", "weight": 0.4 }],
 *   "marketImpact": { "score": 67, "label": "medium", "components": {} },
 *   "whatChanged": {
 *     "newKeywords": ["etf"],
 *     "droppedKeywords": ["hack"],
 *     "sentimentDelta": -5.2,
 *     "newEntities": ["BlackRock"]
 *   },
 *   "summaries": {
 *     "quick": ["…", "…", "…"],
 *     "deep": "…",
 *     "trader": "…",
 *     "whale": "…"
 *   },
 *   "articleIds": ["uuid-…"]
 * }
 * ```
 */
export type IntelKeyword = {
  term: string;
  count: number;
  sentiment: number;
  categoryHint: TopicCategoryId;
};

export type TopicCategoryId =
  | "etf"
  | "regulation"
  | "hack"
  | "defi"
  | "ai"
  | "macro"
  | "listing"
  | "general";
/* "general" = no strong match */

export type HourEntities = {
  coins: string[];
  organizations: string[];
  people: string[];
};

export type MarketImpactLabel = "low" | "medium" | "high";

export type MarketImpact = {
  score: number;
  label: MarketImpactLabel;
  components: {
    articleVolume: number;
    topCoinMentions: number;
    sentimentIntensity: number;
    sourceCredibility: number;
  };
};

export type WhatChanged = {
  newKeywords: string[];
  droppedKeywords: string[];
  sentimentDelta: number;
  newEntities: string[];
  categoryShifts: { from: TopicCategoryId; to: TopicCategoryId; note: string }[];
};

export type HourSummaries = {
  quick: string[];
  deep: string;
  trader: string;
  whale: string;
};

export type HourIntelligencePayload = {
  version: 1;
  zone: "America/Chicago";
  hourStartIso: string;
  hourEndIso: string;
  keywords: IntelKeyword[];
  entities: HourEntities;
  hourSentiment: number;
  categories: { id: TopicCategoryId; weight: number }[];
  marketImpact: MarketImpact;
  whatChanged: WhatChanged | null;
  summaries: HourSummaries;
  articleCount: number;
  articleIds: string[];
};
