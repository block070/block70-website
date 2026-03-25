import { NextRequest, NextResponse } from "next/server";
import {
  fetchOHLCVWithFallback,
  type ChartTimeframeKey,
} from "@/lib/ohlcv-providers";

const TIMEFRAMES = new Set<string>(["1H", "4H", "1D", "7D"]);

/** Short-lived server cache to avoid duplicate external calls within a minute */
const memCache = new Map<string, { at: number; payload: Record<string, unknown> }>();
const MEM_TTL_MS = 55_000;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> | { symbol: string } }
) {
  const params = await Promise.resolve(context.params);
  const symbol = decodeURIComponent(params.symbol || "").trim();
  const tfParam =
    (request.nextUrl.searchParams.get("timeframe") || "1D").toUpperCase();
  const slug = request.nextUrl.searchParams.get("slug")?.trim() || null;

  if (!symbol) {
    return NextResponse.json(
      { ohlcv: [], error: "Missing symbol", source: null },
      { status: 400 }
    );
  }

  const timeframe: ChartTimeframeKey = TIMEFRAMES.has(tfParam)
    ? (tfParam as ChartTimeframeKey)
    : "1D";

  const cacheKey = `${symbol}|${timeframe}|${slug ?? ""}`;
  const hit = memCache.get(cacheKey);
  if (hit && Date.now() - hit.at < MEM_TTL_MS) {
    return NextResponse.json(hit.payload, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  }

  try {
    const { ohlcv, source } = await fetchOHLCVWithFallback(
      symbol,
      timeframe,
      slug
    );

    let bars = ohlcv;
    if (timeframe === "7D" && bars.length > 7) {
      bars = bars.slice(-7);
    }

    const payload = {
      ohlcv: bars,
      source,
      timeframe,
      error: null as string | null,
    };
    memCache.set(cacheKey, { at: Date.now(), payload });
    if (memCache.size > 500) {
      const oldest = [...memCache.keys()].slice(0, 100);
      oldest.forEach((k) => memCache.delete(k));
    }

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chart data unavailable";
    return NextResponse.json(
      { ohlcv: [], source: null, timeframe, error: msg },
      { status: 502 }
    );
  }
}
