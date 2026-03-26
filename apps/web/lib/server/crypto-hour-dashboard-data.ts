import { addHours } from "date-fns";
import type { Pool } from "pg";

import type { HourIntelligencePayload } from "@/lib/crypto-hour-intelligence-types";
import type { PublishedArticleDTO } from "@/lib/crypto-hour-dto";
import { chicagoHourRangeUtc, nowChicagoParts } from "@/lib/server/crypto-hour-buckets";
import { computeHourIntelligence } from "@/lib/server/crypto-hour-intelligence";
import type { PublishedArticleRow } from "@/lib/server/published-articles";
import { listPublishedArticlesInRange } from "@/lib/server/published-articles";

export type HourDashboardBundle = {
  intel: HourIntelligencePayload;
  articles: PublishedArticleDTO[];
  nav: { year: number; month: number; day: number; hour: number };
};

export function toArticleDto(rows: PublishedArticleRow[]): PublishedArticleDTO[] {
  return rows.map((a) => ({
    topic_id: a.topic_id,
    topic_slug: a.topic_slug,
    title: a.title,
    body_markdown: a.body_markdown,
    meta: a.meta,
    updated_at: a.updated_at.toISOString(),
  }));
}

export async function loadHourDashboard(
  pool: Pool,
  year: number,
  month: number,
  day: number,
  hour: number,
): Promise<HourDashboardBundle> {
  const { start, end } = chicagoHourRangeUtc(year, month, day, hour);
  const prevStart = addHours(start, -1);
  const prevEnd = start;

  const [articles, prevArticles] = await Promise.all([
    listPublishedArticlesInRange(pool, start, end, 200),
    listPublishedArticlesInRange(pool, prevStart, prevEnd, 200),
  ]);

  let prevIntel: Parameters<typeof computeHourIntelligence>[4] = null;
  if (prevArticles.length) {
    const snap = computeHourIntelligence(prevStart, prevEnd, prevArticles, null, null);
    prevIntel = {
      avgSentiment: snap.hourSentiment,
      keywords: snap.keywords,
      entities: snap.entities,
    };
  }

  const intel = computeHourIntelligence(start, end, articles, prevArticles, prevIntel);

  return {
    intel,
    articles: toArticleDto(articles),
    nav: { year, month, day, hour },
  };
}

/** Default hour for /year/:y/:m/:d when no hour segment — current hour if “today”, else noon CT. */
export function defaultHourForChicagoDay(year: number, month: number, day: number): number {
  const now = nowChicagoParts();
  if (now.year === year && now.month === month && now.day === day) return now.hour;
  return 12;
}
