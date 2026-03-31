import { getMarketCoins } from "@/lib/api";
import { getCoinsList } from "@/lib/coins";
import {
  coinListItemToCoin,
  coinsToTraderRows,
  marketCoinToCoin,
} from "@/lib/map-coins-to-scanner";
import type { TraderScannerRow } from "@/lib/coins-scanner";

export type CoinsPageData = {
  items: TraderScannerRow[];
  nextOffset: number;
  hasMore: boolean;
  generatedAt: string;
};

/**
 * Same resolution order as GET /api/coins — use everywhere the scanner data must match
 * (homepage dashboard, etc.) without HTTP self-calls (avoids deadlocks / divergent bases).
 */
export async function loadCoinsPageData(params: {
  limit: number;
  offset: number;
}): Promise<CoinsPageData> {
  const limit = Math.min(200, Math.max(1, params.limit));
  const offset = Math.max(0, params.offset);
  const page = Math.floor(offset / limit) + 1;
  const generatedAt = new Date().toISOString();

  try {
    const list = await getCoinsList({ limit, page });
    if (list.length > 0) {
      const coins = list.map((item, i) => coinListItemToCoin(item, offset + i + 1));
      const items = coinsToTraderRows(coins);
      return {
        items,
        nextOffset: offset + items.length,
        hasMore: items.length >= limit,
        generatedAt,
      };
    }
  } catch {
    /* fallback to market */
  }

  const chunk = await getMarketCoins({ limit, page });
  const coins = chunk.map((m, i) => marketCoinToCoin(m, offset + i + 1));
  const items = coinsToTraderRows(coins);
  return {
    items,
    nextOffset: offset + items.length,
    hasMore: items.length >= limit,
    generatedAt,
  };
}
