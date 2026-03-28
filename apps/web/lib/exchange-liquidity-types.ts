/** Normalized CoinGecko exchange detail from `/api/v1/exchanges/[id]/detail`. */
export type ExchangeCgTopTicker = {
  base: string;
  target: string;
  converted_volume_usd: number;
  bid_ask_spread_percentage: number | null;
  trade_url: string | null;
  coin_id: string | null;
};

export type ExchangeCgDetailPayload = {
  id: string;
  name: string;
  image: string;
  url: string;
  country: string | null;
  year_established: number | null;
  trust_score: number;
  trust_score_rank: number;
  trade_volume_24h_btc: number;
  trade_volume_24h_normalized_usd: number;
  tickers_count: number;
  centralized: boolean | null;
  description: string;
  top_tickers: ExchangeCgTopTicker[];
};

export type ExchangeVolumeChartPayload = {
  series: [number, number][];
};

export function medianSpreadPercent(
  tickers: ExchangeCgTopTicker[],
  k: number,
): number | null {
  const spreads = tickers
    .slice(0, k)
    .map((t) => t.bid_ask_spread_percentage)
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (!spreads.length) return null;
  const sorted = [...spreads].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function topCoinsByVolume(
  tickers: ExchangeCgTopTicker[],
  limit: number,
): { coin_id: string; volumeUsd: number }[] {
  const map = new Map<string, number>();
  for (const t of tickers) {
    if (!t.coin_id) continue;
    map.set(t.coin_id, (map.get(t.coin_id) ?? 0) + t.converted_volume_usd);
  }
  return [...map.entries()]
    .map(([coin_id, volumeUsd]) => ({ coin_id, volumeUsd }))
    .sort((a, b) => b.volumeUsd - a.volumeUsd)
    .slice(0, limit);
}
