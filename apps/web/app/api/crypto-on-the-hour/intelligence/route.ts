import { addHours } from "date-fns";
import { NextResponse } from "next/server";

import type { HourIntelligencePayload } from "@/lib/crypto-hour-intelligence-types";
import { chicagoHourRangeUtc } from "@/lib/server/crypto-hour-buckets";
import { computeHourIntelligence } from "@/lib/server/crypto-hour-intelligence";
import { getCryptoHourPool } from "@/lib/server/crypto-hour-pool";
import { listPublishedArticlesInRange } from "@/lib/server/published-articles";

export const runtime = "nodejs";

function num(v: string | null, fallback: number): number {
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const y = num(url.searchParams.get("year"), 0);
  const mo = num(url.searchParams.get("month"), 0);
  const d = num(url.searchParams.get("day"), 0);
  const h = num(url.searchParams.get("hour"), 0);

  if (y < 2020 || mo < 1 || mo > 12 || d < 1 || d > 31 || h < 0 || h > 23) {
    return NextResponse.json(
      { error: "Invalid or missing year, month, day, hour (Chicago wall clock)." },
      { status: 400 },
    );
  }

  const pool = getCryptoHourPool();
  if (!pool) {
    return NextResponse.json({ error: "CRYPTO_HOUR_DATABASE_URL not configured" }, { status: 503 });
  }

  const { start, end } = chicagoHourRangeUtc(y, mo, d, h);
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

  return NextResponse.json(intel satisfies HourIntelligencePayload);
}
