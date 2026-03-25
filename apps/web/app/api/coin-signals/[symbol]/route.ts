import { NextResponse } from "next/server";

import type { CoinSignalsPayload } from "@/lib/coin-signals-types";

export const revalidate = 3600;

function cothBaseUrl(): string {
  const u = process.env.CRYPTO_ON_THE_HOUR_URL?.replace(/\/$/, "");
  return u ?? "";
}

function emptyPayload(symbol: string): CoinSignalsPayload {
  return {
    symbol: symbol.toUpperCase(),
    sentiment: "neutral",
    sentimentScore: 0.5,
    aggregateScore: 0,
    topics: [],
    mentions: [],
    relatedCoins: [],
    latestPipelineHourUnix: null,
    source: "empty",
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> | { symbol: string } },
): Promise<NextResponse<CoinSignalsPayload | { error: string }>> {
  const { symbol: raw } = await Promise.resolve(context.params);
  const symbol = decodeURIComponent(raw ?? "").trim();
  if (!symbol || symbol.length > 32) {
    return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  }

  const base = cothBaseUrl();
  if (base) {
    try {
      const res = await fetch(`${base}/signals/coin/${encodeURIComponent(symbol)}`, {
        next: { revalidate: 3600 },
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as CoinSignalsPayload;
        return NextResponse.json({ ...data, source: "live" });
      }
    } catch {
      /* fall through to empty */
    }
  }

  return NextResponse.json(emptyPayload(symbol));
}
