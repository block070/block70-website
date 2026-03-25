import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  (process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

const ALLOWED_TF = new Set(["1m", "5m", "1h", "4h", "1d"]);

/** Short-lived server cache so repeat hits do not hammer the Python API */
const memCache = new Map<string, { at: number; body: string }>();
const MEM_TTL_MS = 45_000;

export async function GET(request: NextRequest) {
  const coin = request.nextUrl.searchParams.get("coin")?.trim();
  const tfRaw = (request.nextUrl.searchParams.get("timeframe") || "1h").toLowerCase();
  const timeframe = ALLOWED_TF.has(tfRaw) ? tfRaw : "1h";

  if (!coin) {
    return NextResponse.json(
      { error: "Missing coin (slug or ticker)", ohlc: [], volume: [], indicators: {} },
      { status: 400 }
    );
  }

  if (!API_BASE) {
    return NextResponse.json(
      { error: "API backend not configured", ohlc: [], volume: [], indicators: {} },
      { status: 503 }
    );
  }

  const cacheKey = `${coin}|${timeframe}`;
  const hit = memCache.get(cacheKey);
  if (hit && Date.now() - hit.at < MEM_TTL_MS) {
    try {
      const cached = JSON.parse(hit.body) as { ohlc?: unknown[] };
      if (Array.isArray(cached?.ohlc) && cached.ohlc.length > 0) {
        return new NextResponse(hit.body, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, s-maxage=50, stale-while-revalidate=120",
          },
        });
      }
    } catch {
      /* invalid cache entry */
    }
    memCache.delete(cacheKey);
  }

  const url = `${API_BASE}/api/v1/chart?${new URLSearchParams({ coin, timeframe }).toString()}`;
  try {
    // Do not use Next fetch Data Cache — it can pin empty 4h/1d bodies after a transient miss.
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        {
          error: `Chart API ${res.status}`,
          ohlc: [],
          volume: [],
          indicators: {},
        },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }
    try {
      const parsed = JSON.parse(text) as { ohlc?: unknown[] };
      const len = Array.isArray(parsed?.ohlc) ? parsed.ohlc.length : 0;
      if (len > 0) {
        memCache.set(cacheKey, { at: Date.now(), body: text });
      }
    } catch {
      /* still return body below */
    }
    if (memCache.size > 400) {
      for (const k of [...memCache.keys()].slice(0, 80)) memCache.delete(k);
    }
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=50, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chart fetch failed";
    return NextResponse.json(
      { error: msg, ohlc: [], volume: [], indicators: {} },
      { status: 502 }
    );
  }
}
