import { addHours } from "date-fns";
import type { Pool } from "pg";

import type { HourIntelligencePayload, SentimentTrendPoint } from "@/lib/crypto-hour-intelligence-types";
import type { PublishedArticleDTO } from "@/lib/crypto-hour-dto";
import {
  chicagoDayEndUtc,
  chicagoDayStartUtc,
  chicagoHourRangeUtc,
  nowChicagoParts,
  previousChicagoCalendarDay,
} from "@/lib/server/crypto-hour-buckets";
import { batchSentiment, computeHourIntelligence } from "@/lib/server/crypto-hour-intelligence";
import type { PublishedArticleRow } from "@/lib/server/published-articles";
import { listPublishedArticlesInRange } from "@/lib/server/published-articles";

export type HourDashboardBundle = {
  intel: HourIntelligencePayload;
  articles: PublishedArticleDTO[];
  nav: { year: number; month: number; day: number; hour: number };
  /** Left → right: trend slots (hour view = last 6 hours; day view = sixths of the calendar day). */
  sentimentTrend: SentimentTrendPoint[];
  /** `day` = full Chicago calendar day; `hour` = single clock hour. */
  viewGranularity: "day" | "hour";
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

  const slotRanges = Array.from({ length: 6 }, (_, idx) => {
    const j = 5 - idx;
    return {
      slotStart: addHours(start, -j),
      slotEnd: addHours(start, -j + 1),
    };
  });
  const slotRows = await Promise.all(
    slotRanges.map((r) => listPublishedArticlesInRange(pool, r.slotStart, r.slotEnd, 200)),
  );
  const sentimentTrend: SentimentTrendPoint[] = slotRanges.map((r, idx) => ({
    label: new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: false,
    }).format(r.slotStart),
    hourStartIso: r.slotStart.toISOString(),
    sentiment: batchSentiment(slotRows[idx]!),
  }));

  return {
    intel,
    articles: toArticleDto(articles),
    nav: { year, month, day, hour },
    sentimentTrend,
    viewGranularity: "hour",
  };
}

/** Full Chicago calendar day: narrative keywords + briefings aggregated; hour pills drill down. */
export async function loadDayDashboard(
  pool: Pool,
  year: number,
  month: number,
  day: number,
): Promise<HourDashboardBundle> {
  const start = chicagoDayStartUtc(year, month, day);
  const end = chicagoDayEndUtc(year, month, day);
  const { year: py, month: pm, day: pd } = previousChicagoCalendarDay(year, month, day);
  const prevStart = chicagoDayStartUtc(py, pm, pd);
  const prevEnd = chicagoDayEndUtc(py, pm, pd);

  const [articles, prevArticles] = await Promise.all([
    listPublishedArticlesInRange(pool, start, end, 500),
    listPublishedArticlesInRange(pool, prevStart, prevEnd, 500),
  ]);

  let prevIntel: Parameters<typeof computeHourIntelligence>[4] = null;
  if (prevArticles.length) {
    const snap = computeHourIntelligence(prevStart, prevEnd, prevArticles, null, null, "day");
    prevIntel = {
      avgSentiment: snap.hourSentiment,
      keywords: snap.keywords,
      entities: snap.entities,
    };
  }

  const intel = computeHourIntelligence(start, end, articles, prevArticles, prevIntel, "day");

  const ms = end.getTime() - start.getTime();
  const slotRanges = Array.from({ length: 6 }, (_, idx) => ({
    slotStart: new Date(start.getTime() + (ms * idx) / 6),
    slotEnd: new Date(start.getTime() + (ms * (idx + 1)) / 6),
  }));
  const slotRows = await Promise.all(
    slotRanges.map((r) => listPublishedArticlesInRange(pool, r.slotStart, r.slotEnd, 200)),
  );
  const sentimentTrend: SentimentTrendPoint[] = slotRanges.map((r, idx) => ({
    label: new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: true,
    }).format(r.slotStart),
    hourStartIso: r.slotStart.toISOString(),
    sentiment: batchSentiment(slotRows[idx]!),
  }));

  const now = nowChicagoParts();
  const defaultHour =
    now.year === year && now.month === month && now.day === day ? now.hour : 12;

  return {
    intel,
    articles: toArticleDto(articles),
    nav: { year, month, day, hour: defaultHour },
    sentimentTrend,
    viewGranularity: "day",
  };
}

/** Default hour for /year/:y/:m/:d when no hour segment — current hour if “today”, else noon CT. */
export function defaultHourForChicagoDay(year: number, month: number, day: number): number {
  const now = nowChicagoParts();
  if (now.year === year && now.month === month && now.day === day) return now.hour;
  return 12;
}
