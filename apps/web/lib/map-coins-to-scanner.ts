import type { MarketCoin } from "@/lib/api";
import type { CoinListItemDto } from "@/lib/coins";
import { L1_SLUGS } from "@/lib/coin-scanner-tags";
import { toTraderRow, type TraderScannerRow } from "@/lib/coins-scanner";
import type { Coin } from "@/lib/crypto-mock";

export function traderScannerRowToMarketCoin(row: TraderScannerRow): MarketCoin {
  const p =
    row.priceUsd != null && Number.isFinite(row.priceUsd) && row.priceUsd > 0 ? row.priceUsd : null;
  return {
    name: row.name,
    symbol: (row.symbol || "").toUpperCase(),
    slug: row.slug,
    logo_url: row.logoUrl ?? null,
    price: p,
    change_24h:
      typeof row.change24hPct === "number" && Number.isFinite(row.change24hPct)
        ? row.change24hPct
        : null,
    change_7d:
      typeof row.change7dPct === "number" && Number.isFinite(row.change7dPct) ? row.change7dPct : null,
    market_cap:
      row.marketCapUsd != null && Number.isFinite(row.marketCapUsd) ? row.marketCapUsd : null,
    volume:
      row.volume24hUsd != null && Number.isFinite(row.volume24hUsd) ? row.volume24hUsd : null,
  };
}

export function traderScannerRowsToMarketCoins(rows: TraderScannerRow[]): MarketCoin[] {
  return rows.map(traderScannerRowToMarketCoin);
}

/** Same field resolution as the /coins scanner, shaped for dashboard/market blocks. */
export function coinListItemToMarketCoin(item: CoinListItemDto): MarketCoin {
  const c = item.coin;
  const md = item.latest_market_data;
  const sym = (c.symbol || "").toUpperCase();
  return {
    name: c.name,
    symbol: sym,
    slug: c.slug,
    logo_url: c.logo_url ?? null,
    price:
      c.price != null && Number.isFinite(c.price)
        ? c.price
        : md?.price != null && Number.isFinite(md.price)
          ? md.price
          : null,
    change_24h:
      md?.price_change_24h != null && Number.isFinite(md.price_change_24h)
        ? md.price_change_24h
        : null,
    change_7d:
      md?.price_change_7d != null && Number.isFinite(md.price_change_7d)
        ? md.price_change_7d
        : null,
    market_cap:
      c.market_cap != null && Number.isFinite(c.market_cap)
        ? c.market_cap
        : md?.market_cap != null && Number.isFinite(md.market_cap)
          ? md.market_cap
          : null,
    volume:
      c.volume_24h != null && Number.isFinite(c.volume_24h)
        ? c.volume_24h
        : md?.volume_24h != null && Number.isFinite(md.volume_24h)
          ? md.volume_24h
          : null,
  };
}

export function coinListItemsToMarketCoins(items: CoinListItemDto[]): MarketCoin[] {
  return items.map(coinListItemToMarketCoin);
}

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
