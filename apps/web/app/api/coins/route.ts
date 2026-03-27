import { NextRequest, NextResponse } from "next/server";
import { getMarketCoins } from "@/lib/api";
import { getCoinsList } from "@/lib/coins";
import {
  coinListItemToCoin,
  coinsToTraderRows,
  marketCoinToCoin,
} from "@/lib/map-coins-to-scanner";

const CACHE_REV = 45;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") ?? "100", 10) || 100));
  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);
  const page = Math.floor(offset / limit) + 1;
  const generatedAt = new Date().toISOString();

  try {
    const list = await getCoinsList({ limit, page });
    if (list.length > 0) {
      const coins = list.map((item, i) => coinListItemToCoin(item, offset + i + 1));
      const items = coinsToTraderRows(coins);
      return NextResponse.json(
        {
          items,
          nextOffset: offset + items.length,
          hasMore: items.length >= limit,
          generatedAt,
        },
        {
          headers: {
            "Cache-Control": `public, s-maxage=${CACHE_REV}, stale-while-revalidate=${CACHE_REV * 2}`,
          },
        }
      );
    }
  } catch {
    /* fallback to market */
  }

  try {
    const chunk = await getMarketCoins({ limit, page });
    const coins = chunk.map((m, i) => marketCoinToCoin(m, offset + i + 1));
    const items = coinsToTraderRows(coins);
    return NextResponse.json(
      {
        items,
        nextOffset: offset + items.length,
        hasMore: items.length >= limit,
        generatedAt,
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_REV}, stale-while-revalidate=${CACHE_REV * 2}`,
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "coins fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
