/**
 * Server-side aggregator for /market macro intelligence.
 * Uses market summary + category directory + optional Alternative.me Fear & Greed.
 */
import { unstable_cache } from "next/cache";
import {
  getCategoryDirectory,
  getMarketCoins,
  getMarketSummary,
  type CategoryDirectoryApiItem,
  type MarketCoin,
  type MarketSummaryResponse,
} from "@/lib/api";
import { withTimeout } from "@/lib/with-timeout";
import type { HeatmapCoin } from "@/components/market/market-heatmap";
import { fetchCoingeckoHomeMarketBundle } from "@/lib/market/coingecko-home-fallback";

export const MACRO_CACHE_SEC = 60;
const FETCH_MS = 8_000;

export type FearGreedPoint = {
  value: number;
  classification: string;
  timestamp: string | null;
  source: "alternative_me" | "synthetic";
};

export type CategoryDominanceRow = {
  id: string;
  name: string;
  sharePct: number;
  marketCap: number;
  change24h: number | null;
};

export type RotationSector = {
  id: string;
  name: string;
  marketCap: number;
  market_cap_change_24h: number | null;
  capital_flow: string;
  trend: string;
  vol_to_mcap: number;
  narrative: string;
};

export type ScatterPoint = {
  symbol: string;
  slug: string;
  volume24h: number;
  change24h: number;
  marketCap: number;
};

export type HistoricalMetric = {
  key: string;
  label: string;
  now: number | null;
  impliedPrior: number | null;
  unit: "usd" | "compact" | "pct";
};

export type MacroDashboardPayload = {
  meta: {
    generatedAt: string;
    marketAsOf: string | null;
    marketSource: string;
    cacheTtlSec: number;
  };
  global: {
    totalMarketCapUsd: number | null;
    totalVolumeUsd: number | null;
    btcDominancePct: number | null;
    ethDominancePct: number | null;
  };
  dominancePie: { name: string; value: number }[];
  categoryDominance: CategoryDominanceRow[];
  rotation: RotationSector[];
  heatmapCoins: HeatmapCoin[];
  fearGreed: { current: FearGreedPoint; previous: FearGreedPoint | null };
  scatter: ScatterPoint[];
  historical: HistoricalMetric[];
};

/** Same tolerances as home dashboard: missing 24h% / volume must not drop the whole tape. */
function normalizeMacroCoin(c: MarketCoin): MarketCoin | null {
  const price =
    typeof c.price === "number" && Number.isFinite(c.price) ? c.price : Number(c.price);
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  const rawMcap =
    typeof c.market_cap === "number" && Number.isFinite(c.market_cap) ? c.market_cap : Number(c.market_cap);
  const rawVol =
    typeof c.volume === "number" && Number.isFinite(c.volume) ? c.volume : Number(c.volume);
  const market_cap = rawMcap != null && Number.isFinite(rawMcap) && rawMcap >= 0 ? rawMcap : 0;
  const volume = rawVol != null && Number.isFinite(rawVol) && rawVol >= 0 ? rawVol : 0;
  const chRaw =
    typeof c.change_24h === "number" && Number.isFinite(c.change_24h) ? c.change_24h : Number(c.change_24h);
  const change_24h = chRaw != null && Number.isFinite(chRaw) ? chRaw : 0;
  const ch7 =
    typeof c.change_7d === "number" && Number.isFinite(c.change_7d) ? c.change_7d : c.change_7d;
  return {
    ...c,
    price,
    market_cap,
    volume,
    change_24h,
    change_7d: ch7,
  };
}

function validCoins(coins: MarketCoin[]): MarketCoin[] {
  return coins.map(normalizeMacroCoin).filter((x): x is MarketCoin => x != null);
}

function mcapWeightedChange24h(coins: MarketCoin[]): number {
  const v = validCoins(coins);
  if (!v.length) return 0;
  const total = v.reduce((s, c) => s + (c.market_cap ?? 0), 0);
  if (total <= 0) return 0;
  return v.reduce((s, c) => s + (c.change_24h ?? 0) * ((c.market_cap ?? 0) / total), 0);
}

function syntheticFearGreed(coins: MarketCoin[]): FearGreedPoint {
  const v = validCoins(coins).slice(0, 24);
  if (!v.length) {
    return { value: 50, classification: "Neutral", timestamp: null, source: "synthetic" };
  }
  const avg = v.reduce((s, c) => s + (c.change_24h ?? 0), 0) / v.length;
  const value = Math.round(Math.max(0, Math.min(100, 50 + avg * 8)));
  let classification = "Neutral";
  if (value <= 24) classification = "Extreme Fear";
  else if (value <= 44) classification = "Fear";
  else if (value <= 55) classification = "Neutral";
  else if (value <= 75) classification = "Greed";
  else classification = "Extreme Greed";
  return { value, classification, timestamp: null, source: "synthetic" };
}

async function fetchAlternativeFearGreed(): Promise<{
  current: FearGreedPoint;
  previous: FearGreedPoint | null;
} | null> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=2", {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { value: string; value_classification?: string; timestamp?: string }[];
    };
    const rows = json?.data;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const toPoint = (row: (typeof rows)[0]): FearGreedPoint => ({
      value: Math.max(0, Math.min(100, Number(row.value))),
      classification: String(row.value_classification ?? "—"),
      timestamp: row.timestamp != null ? String(row.timestamp) : null,
      source: "alternative_me",
    });
    return {
      current: toPoint(rows[0]),
      previous: rows[1] ? toPoint(rows[1]) : null,
    };
  } catch {
    return null;
  }
}

function toHeatmapCoin(c: MarketCoin): HeatmapCoin {
  return {
    symbol: c.symbol,
    name: c.name,
    slug: c.slug,
    logoUrl: c.logo_url ?? null,
    price: c.price ?? 0,
    change24h: c.change_24h ?? 0,
    marketCap: c.market_cap ?? 0,
    volume24h: c.volume ?? 0,
  };
}

function rotationNarrative(c: CategoryDirectoryApiItem): string {
  const chg = c.market_cap_change_24h;
  const flow = c.capital_flow === "in" ? "net inflows" : c.capital_flow === "out" ? "net outflows" : "balanced flow";
  if (typeof chg === "number" && Number.isFinite(chg)) {
    if (chg >= 0.8) return `Leading rotation — ${flow}, risk-on tape in this sleeve.`;
    if (chg <= -0.8) return `Lagging — ${flow}, capital rotating away short-term.`;
    return `Sideways sector drift with ${flow}.`;
  }
  return `${c.trend} tone, ${flow} (${c.name}).`;
}

function buildRotation(categories: CategoryDirectoryApiItem[]): RotationSector[] {
  const sorted = [...categories].sort((a, b) => {
    const pa = typeof a.market_cap_change_24h === "number" ? a.market_cap_change_24h : -Infinity;
    const pb = typeof b.market_cap_change_24h === "number" ? b.market_cap_change_24h : -Infinity;
    return pb - pa;
  });
  return sorted.slice(0, 14).map((c) => ({
    id: c.id,
    name: c.name,
    marketCap: c.market_cap,
    market_cap_change_24h: c.market_cap_change_24h ?? null,
    capital_flow: c.capital_flow,
    trend: c.trend,
    vol_to_mcap: c.vol_to_mcap,
    narrative: rotationNarrative(c),
  }));
}

async function buildMacroDashboardUncached(): Promise<MacroDashboardPayload> {
  const generatedAt = new Date().toISOString();

  const [summaryOutcome, catOutcome, fngAlt] = await Promise.all([
    Promise.allSettled([withTimeout(getMarketSummary(48), FETCH_MS)]).then((r) => r[0]),
    Promise.allSettled([
      withTimeout(getCategoryDirectory({ limit: 24, order: "market_cap" }), FETCH_MS),
    ]).then((r) => r[0]),
    fetchAlternativeFearGreed(),
  ]);

  let summary: MarketSummaryResponse | null =
    summaryOutcome.status === "fulfilled" ? summaryOutcome.value : null;
  const catPayload =
    catOutcome.status === "fulfilled"
      ? catOutcome.value
      : { items: [] as CategoryDirectoryApiItem[], total: 0 };
  let categories = catPayload.items ?? [];

  let topCoins = summary?.top ? validCoins(summary.top) : [];
  if (topCoins.length < 15) {
    try {
      const more = await withTimeout(getMarketCoins({ limit: 80, page: 1 }), FETCH_MS);
      if (more.length) topCoins = validCoins(more);
    } catch {
      /* keep summary slice */
    }
  }

  let g = summary?.global;
  let totalMcap = g?.total_market_cap_usd ?? null;
  let totalVol = g?.total_volume_usd ?? null;
  let btcDom = g?.btc_dominance_pct ?? null;
  let ethDom = g?.eth_dominance_pct ?? null;
  let marketAsOf = summary?.as_of ?? null;
  let marketSource = summary?.source?.trim() || "";

  const globalsMissing =
    (totalMcap == null || totalMcap <= 0) &&
    (totalVol == null || totalVol <= 0) &&
    btcDom == null &&
    ethDom == null;
  const needTape = topCoins.length < 12 || globalsMissing;

  let usedCoingecko = false;
  if (needTape) {
    try {
      const cg = await fetchCoingeckoHomeMarketBundle(100);
      const gn = cg.global;
      if (gn) {
        if (totalMcap == null || totalMcap <= 0)
          totalMcap = gn.total_market_cap_usd ?? totalMcap;
        if (totalVol == null || totalVol <= 0) totalVol = gn.total_volume_usd ?? totalVol;
        if (btcDom == null) btcDom = gn.btc_dominance_pct ?? btcDom;
        if (ethDom == null) ethDom = gn.eth_dominance_pct ?? ethDom;
        usedCoingecko = true;
      }
      if (topCoins.length < 12 && cg.coins.length) {
        topCoins = validCoins(cg.coins);
        usedCoingecko = true;
      }
      if (usedCoingecko && !marketAsOf) {
        marketAsOf = generatedAt;
      }
      if (usedCoingecko) {
        marketSource = marketSource
          ? `${marketSource}+coingecko`
          : "CoinGecko (direct)";
      }
    } catch {
      /* keep API-only snapshot */
    }
  }

  let denom = totalMcap != null && totalMcap > 0 ? totalMcap : 0;
  if (denom <= 0 && categories.length) {
    denom = categories.reduce((s, c) => s + Math.max(0, c.market_cap), 0);
  }

  const categoryDominance: CategoryDominanceRow[] = categories
    .map((c) => {
      const sharePct = denom > 0 ? (c.market_cap / denom) * 100 : 0;
      return {
        id: c.id,
        name: c.name,
        sharePct: Math.min(100, Math.max(0, sharePct)),
        marketCap: c.market_cap,
        change24h: c.market_cap_change_24h ?? null,
      };
    })
    .sort((a, b) => b.sharePct - a.sharePct)
    .slice(0, 12);

  let btc = btcDom ?? 0;
  let eth = ethDom ?? 0;
  if ((!btc || !eth) && topCoins.length) {
    const t = topCoins.reduce((s, c) => s + (c.market_cap ?? 0), 0);
    if (t > 0) {
      const btcRow = topCoins.find((c) => c.symbol.toUpperCase() === "BTC");
      const ethRow = topCoins.find((c) => c.symbol.toUpperCase() === "ETH");
      if (!btc && btcRow?.market_cap) btc = (btcRow.market_cap / t) * 100;
      if (!eth && ethRow?.market_cap) eth = (ethRow.market_cap / t) * 100;
    }
  }
  /** KPI strip: use API dominance when present, else same slice-implied % as the pie. */
  const displayBtcDom = btcDom != null ? btcDom : btc > 0 ? btc : null;
  const displayEthDom = ethDom != null ? ethDom : eth > 0 ? eth : null;

  const other = Math.max(0, 100 - btc - eth);
  const dominancePie = [
    { name: "BTC", value: Math.round(btc * 10) / 10 },
    { name: "ETH", value: Math.round(eth * 10) / 10 },
    { name: "Other", value: Math.round(other * 10) / 10 },
  ].filter((s) => s.value > 0.05);

  const w = mcapWeightedChange24h(topCoins);
  const impliedMcap =
    totalMcap != null && Number.isFinite(w) && w !== -100
      ? totalMcap / (1 + w / 100)
      : null;
  const impliedVol =
    totalVol != null && Number.isFinite(w) && w !== -100
      ? totalVol / (1 + w / 100)
      : null;

  const historical: HistoricalMetric[] = [
    {
      key: "mcap",
      label: "Total market cap",
      now: totalMcap,
      impliedPrior: impliedMcap,
      unit: "compact",
    },
    {
      key: "volume",
      label: "24h volume (global)",
      now: totalVol,
      impliedPrior: impliedVol,
      unit: "compact",
    },
    {
      key: "weighted_moves",
      label: "Mcap-weighted avg move (top sleeve)",
      now: w,
      impliedPrior: null,
      unit: "pct",
    },
  ];

  const heatmapCoins = topCoins.slice(0, 50).map(toHeatmapCoin);
  /** Log-scale scatter: floored volume so majors with data still plot. */
  const scatter: ScatterPoint[] = topCoins.slice(0, 48).map((c) => ({
    symbol: c.symbol,
    slug: c.slug,
    volume24h: Math.max(1, c.volume ?? 0),
    change24h: c.change_24h ?? 0,
    marketCap: Math.max(0, c.market_cap ?? 0),
  }));

  let fearGreed: MacroDashboardPayload["fearGreed"];
  if (fngAlt) {
    fearGreed = { current: fngAlt.current, previous: fngAlt.previous };
  } else {
    const syn = syntheticFearGreed(topCoins);
    fearGreed = { current: syn, previous: null };
  }

  return {
    meta: {
      generatedAt,
      marketAsOf: marketAsOf ?? generatedAt,
      marketSource: marketSource || (usedCoingecko ? "CoinGecko (direct)" : "Block70 API"),
      cacheTtlSec: MACRO_CACHE_SEC,
    },
    global: {
      totalMarketCapUsd: totalMcap,
      totalVolumeUsd: totalVol,
      btcDominancePct: displayBtcDom,
      ethDominancePct: displayEthDom,
    },
    dominancePie,
    categoryDominance,
    rotation: categories.length ? buildRotation(categories) : [],
    heatmapCoins,
    fearGreed,
    scatter,
    historical,
  };
}

const getCachedMacro = unstable_cache(
  async () => buildMacroDashboardUncached(),
  ["macro-intelligence-dashboard-v2"],
  { revalidate: MACRO_CACHE_SEC },
);

export async function buildMacroDashboard(): Promise<MacroDashboardPayload> {
  return getCachedMacro();
}
