import { NextRequest, NextResponse } from "next/server";
import {
  fetchOHLCVWithFallback,
  type ChartTimeframeKey,
} from "@/lib/ohlcv-providers";

const TIMEFRAMES = new Set<string>(["1M", "5M", "1H", "4H", "1D", "7D"]);

/**
 * Two TTLs on the same entry:
 *  - `MEM_TTL_MS` — fresh window; serve cached payload directly.
 *  - `STALE_TTL_MS` — grace window; serve stale only if upstream is currently
 *    failing, with a `X-Chart-Stale: 1` header so callers can tell.
 *
 * This keeps the UI chart populated across transient CoinGecko 429s and short
 * upstream outages instead of blanking to an error state.
 */
const memCache = new Map<string, { at: number; payload: Record<string, unknown> }>();
const MEM_TTL_MS = 55_000;
const STALE_TTL_MS = 30 * 60_000;

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

    // Prefer serving a stale-but-valid cached response over an error when we
    // have one in the grace window — upstream blips shouldn't blank a chart.
    if (hit && Date.now() - hit.at < STALE_TTL_MS) {
      return NextResponse.json(hit.payload, {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
          "X-Chart-Stale": "1",
        },
      });
    }

    // No cache to fall back on. We still return 200 so the browser console
    // isn't polluted with red 502s — the client already renders this shape as
    // an empty-state with an explanatory message. Reserve non-2xx for genuine
    // server bugs (validation, misconfiguration), not "upstream had no data".
    return NextResponse.json(
      { ohlcv: [], source: null, timeframe, error: msg },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" },
      }
    );
  }
}
