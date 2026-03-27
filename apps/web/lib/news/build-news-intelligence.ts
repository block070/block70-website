import type { NewsArticleSummary } from "@/lib/api";
import {
  type EnrichedNewsArticle,
  type NarrativeClusterId,
  type SentimentTrendWindows,
  type TrendingKeyword,
  enrichNewsArticle,
  rankArticlesForWhatMatters,
  sentimentTrendFromArticles,
  trendingKeywordsFromArticles,
} from "./enrich";

export type NewsIntelligencePayload = {
  generatedAt: string;
  articles: EnrichedNewsArticle[];
  whatMatters: EnrichedNewsArticle[];
  trendingKeywords: TrendingKeyword[];
  sentimentTrend: SentimentTrendWindows | null;
  clusterCounts: Record<NarrativeClusterId, number>;
};

export function buildNewsIntelligence(items: NewsArticleSummary[]): NewsIntelligencePayload {
  const generatedAt = new Date().toISOString();
  const articles = items.map(enrichNewsArticle);

  const ranked = rankArticlesForWhatMatters(articles);
  const whatMatters = ranked.slice(0, 3);

  const trendingKeywords = trendingKeywordsFromArticles(items, 14);
  const sentimentTrend = sentimentTrendFromArticles(items);

  const clusterCounts: Record<NarrativeClusterId, number> = {
    etf: 0,
    regulation: 0,
    ai: 0,
    defi: 0,
  };
  for (const a of articles) {
    for (const c of a.clusters) {
      clusterCounts[c] += 1;
    }
  }

  return {
    generatedAt,
    articles,
    whatMatters,
    trendingKeywords,
    sentimentTrend,
    clusterCounts,
  };
}
