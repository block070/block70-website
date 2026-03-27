import type { MarketCoin } from "@/lib/api";
import type { CoinListItemDto } from "@/lib/coins";
import type { Coin } from "@/lib/crypto-mock";
import { L1_SLUGS } from "@/lib/coin-scanner-tags";
import { toTraderRow, type TraderScannerRow } from "@/lib/coins-scanner";

export function coinsToTraderRows(coins: Coin[]): TraderScannerRow[] {
  return coins.map(toTraderRow);
}

export function coinListItemToCoin(item: CoinListItemDto, rank: number): Coin {
  const md = item.latest_market_data;
  const c = item.coin;
  const scannerCategoryLabels: string[] = [];
  if (c.category) scannerCategoryLabels.push(c.category);
  if (c.categories?.length) {
    for (const cat of c.categories) {
      if (cat?.name && !scannerCategoryLabels.includes(cat.name)) {
        scannerCategoryLabels.push(cat.name);
      }
    }
  }
  return {
    id: String(c.id),
    slug: c.slug,
    symbol: c.symbol,
    name: c.name,
    priceUsd: c.price ?? md?.price ?? 0,
    marketCapUsd: c.market_cap ?? md?.market_cap ?? 0,
    volume24hUsd: c.volume_24h ?? md?.volume_24h ?? 0,
    change24hPct: md?.price_change_24h ?? Number.NaN,
    change7dPct: md?.price_change_7d ?? Number.NaN,
    rank,
    categoryIds: c.category ? [c.category] : [],
    chainIds: c.chain ? [c.chain] : [],
    logoUrl: c.logo_url,
    categorySlug: c.category_slug,
    categoryLabel: c.category ?? c.categories?.find((x) => x.primary)?.name ?? null,
    scannerCategoryLabels: scannerCategoryLabels.length ? scannerCategoryLabels : undefined,
  };
}

export function marketCoinToCoin(m: MarketCoin, rank: number): Coin {
  const isL1 = L1_SLUGS.has(m.slug);
  const fallbackLabel = isL1 ? "Layer 1" : "Digital asset";
  return {
    id: m.slug,
    slug: m.slug,
    symbol: m.symbol,
    name: m.name,
    priceUsd: m.price ?? 0,
    marketCapUsd: m.market_cap ?? 0,
    volume24hUsd: m.volume ?? 0,
    change24hPct: m.change_24h ?? Number.NaN,
    change7dPct: m.change_7d ?? Number.NaN,
    rank,
    categoryIds: [],
    chainIds: [],
    logoUrl: m.logo_url ?? null,
    categoryLabel: fallbackLabel,
    scannerCategoryLabels: isL1 ? ["L1"] : [fallbackLabel],
  };
}
