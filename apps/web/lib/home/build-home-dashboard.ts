/**
 * Aggregates all home “command center” data in one builder (used by GET /api/home/dashboard).
 * Always returns a full payload — live API when available, curated fallbacks when not.
 * Market tiles use the same loader as GET /api/coins so scanner and heatmap stay identical.
 */
import {
  getCategoryDirectory,
  getInsightsTrending,
  getMarketCoins,
  getMarketSummary,
  getNewsArticles,
  getOpportunities,
  getSignalsLatest,
  getSignalsTrending,
  getWalletLeaderboard,
  type CategoryDirectoryApiItem,
  type MarketCoin,
  type NewsArticleSummary,
} from "@/lib/api";
import { traderScannerRowsToMarketCoins } from "@/lib/map-coins-to-scanner";
import { loadCoinsPageData } from "@/lib/market/load-coins-page-data";
import {
  aiSummaryForNews,
  narrativeImpactFromNews,
  sentimentForNews,
} from "@/lib/news/enrich";
import { withTimeout } from "@/lib/with-timeout";
import {
  fetchCoingeckoHomeMarketBundle,
  type CoingeckoGlobalNumbers,
} from "@/lib/market/coingecko-home-fallback";
import type { Opportunity, SignalDto, WalletLeaderboardEntry } from "@/lib/types";

/**
 * Advertised TTL for API/CDN caching (non-demo). Demo builds stay uncached (see getHomeDashboardPayload).
 */
export const HOME_DASHBOARD_CACHE_SEC =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? 0 : 60;
const FETCH_MS = 8_000;
const COINS_PAGE_FETCH_MS = 12_000;
/** Same as macro dashboard — CoinGecko can be slower than FastAPI. */
const CG_FETCH_MS = 20_000;

export type HeroNarrativeChip = {
  id: string;
  name: string;
  trend: "bullish" | "neutral" | "bearish";
  capitalFlow: "in" | "out" | "neutral";
};

export type VolumeSpikeRow = {
  symbol: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  volume24h: number;
  marketCap: number;
  volToMcap: number;
  change24h: number;
};

export type NarrativeEngineRow = {
  id: string;
  name: string;
  sentimentScore: number;
  trend: "bullish" | "neutral" | "bearish";
  capitalFlow: "in" | "out" | "neutral";
  volToMcap: number;
  avgChange24h: number | null;
  topSymbols: string[];
};

export type SmartMoneyFlow = {
  label: string;
  direction: "in" | "out";
  amountLabel: string;
  detail: string;
};

export type NewsIntelRow = {
  id: number;
  title: string;
  source: string;
  url: string;
  aiSummary: string;
  narrativeImpact: number;
  impactSentiment: "bullish" | "bearish" | "neutral";
  publishedAt: string | null;
};

export type MoverRow = {
  symbol: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
};

export type HomeDashboardPayload = {
  meta: {
    generatedAt: string;
    cacheTtlSec: number;
    marketSource?: string;
    marketAsOf?: string;
  };
  hero: {
    totalMarketCapUsd: number | null;
    volume24hUsd: number | null;
    btcDominancePct: number | null;
    ethDominancePct: number | null;
    sentiment: "bullish" | "bearish" | "neutral";
    sentimentScore: number;
    topNarratives: HeroNarrativeChip[];
    insightHeadline: string | null;
  };
  market: {
    gainers: MoverRow[];
    losers: MoverRow[];
    heatmap: {
      symbol: string;
      name: string;
      slug: string;
      logoUrl: string | null;
      price: number;
      change24h: number;
      marketCap: number;
      volume24h: number;
    }[];
    volumeSpikes: VolumeSpikeRow[];
  };
  narratives: NarrativeEngineRow[];
  smartMoney: {
    wallets: WalletLeaderboardEntry[];
    flows: SmartMoneyFlow[];
  };
  signals: SignalDto[];
  news: NewsIntelRow[];
  opportunities: Opportunity[];
};

/** FastAPI / ORM occasionally serializes decimals as strings — coerce so rows aren’t dropped. */
function toFiniteNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Normalize API/DB rows for dashboard use — same numeric coercion as macro dashboard
 * so string decimals and CG edge shapes do not empty the tape / hero totals.
 */
function normalizeDashboardCoin(c: MarketCoin): MarketCoin | null {
  const price =
    typeof c.price === "number" && Number.isFinite(c.price) ? c.price : Number(c.price);
  const rawMcap =
    typeof c.market_cap === "number" && Number.isFinite(c.market_cap)
      ? c.market_cap
      : Number(c.market_cap);
  const rawVol =
    typeof c.volume === "number" && Number.isFinite(c.volume) ? c.volume : Number(c.volume);
  const market_cap =
    rawMcap != null && Number.isFinite(rawMcap) && rawMcap >= 0 ? rawMcap : 0;
  const volume = rawVol != null && Number.isFinite(rawVol) && rawVol >= 0 ? rawVol : 0;
  const priceOk = price != null && Number.isFinite(price) && price > 0;
  /** Keep rows with mcap/volume for hero totals and dominance when price is oddly null (API/CG quirks). */
  if (!priceOk && market_cap <= 0 && volume <= 0) return null;
  const chRaw =
    typeof c.change_24h === "number" && Number.isFinite(c.change_24h)
      ? c.change_24h
      : Number(c.change_24h);
  const change_24h = chRaw != null && Number.isFinite(chRaw) ? chRaw : 0;
  const ch7 =
    typeof c.change_7d === "number" && Number.isFinite(c.change_7d)
      ? c.change_7d
      : Number(c.change_7d);
  return {
    ...c,
    price: priceOk ? price : null,
    market_cap,
    volume,
    change_24h,
    change_7d: ch7,
  };
}

function dashboardMarketCoins(coins: MarketCoin[]): MarketCoin[] {
  return coins.map(normalizeDashboardCoin).filter((x): x is MarketCoin => x != null);
}

type HeroMetricsMutable = {
  totalMarketCapUsd: number | null;
  volume24hUsd: number | null;
  btcDominancePct: number | null;
  ethDominancePct: number | null;
};

/** BTC/ETH rows for dominance when the scanner slice omits majors or uses odd symbols. */
function findBtcEthForDominance(list: MarketCoin[]): {
  btc: MarketCoin | undefined;
  eth: MarketCoin | undefined;
} {
  const norm = dashboardMarketCoins(list);
  const btc =
    norm.find((c) => (c.symbol || "").toUpperCase() === "BTC") ||
    norm.find((c) => (c.slug || "").toLowerCase() === "bitcoin");
  const eth =
    norm.find((c) => (c.symbol || "").toUpperCase() === "ETH") ||
    norm.find((c) => (c.slug || "").toLowerCase() === "ethereum");
  return { btc, eth };
}

/**
 * Derive hero snapshot from a cap-weighted list when /global (or FastAPI) omits totals.
 * Uses the CoinGecko top-N list for fills even if the heatmap vk is a curated scanner slice.
 */
function fillHeroMetricsFromCoinUniverse(rawCoins: MarketCoin[], hero: HeroMetricsMutable): void {
  const list = dashboardMarketCoins(rawCoins);
  if (!list.length) return;

  const mSum = list.reduce((s, c) => s + Math.max(0, c.market_cap ?? 0), 0);
  const vSum = list.reduce((s, c) => s + Math.max(0, c.volume ?? 0), 0);

  if (hero.totalMarketCapUsd == null && mSum > 0) {
    hero.totalMarketCapUsd = mSum;
  }
  if (hero.volume24hUsd == null && vSum > 0) {
    hero.volume24hUsd = vSum;
  }

  const { btc, eth } = findBtcEthForDominance(list);
  const denom = mSum > 0 ? mSum : 0;
  if (denom <= 0) return;

  if (hero.btcDominancePct == null && btc != null && (btc.market_cap ?? 0) > 0) {
    const p = ((btc.market_cap ?? 0) / denom) * 100;
    if (Number.isFinite(p)) hero.btcDominancePct = p;
  }
  if (hero.ethDominancePct == null && eth != null && (eth.market_cap ?? 0) > 0) {
    const p = ((eth.market_cap ?? 0) / denom) * 100;
    if (Number.isFinite(p)) hero.ethDominancePct = p;
  }
}

function sentimentFromCoins(coins: MarketCoin[]): {
  label: "bullish" | "bearish" | "neutral";
  score: number;
} {
  const v = dashboardMarketCoins(coins).slice(0, 24);
  if (!v.length) return { label: "neutral", score: 0 };
  const avg = v.reduce((s, c) => s + (c.change_24h ?? 0), 0) / v.length;
  const score = Math.max(-100, Math.min(100, Math.round(avg * 8)));
  if (avg > 0.75) return { label: "bullish", score };
  if (avg < -0.75) return { label: "bearish", score };
  return { label: "neutral", score };
}

function fallbackWallets(): WalletLeaderboardEntry[] {
  return [
    {
      wallet_address: "0x28c6c06298d514db089934071355e5743bf21d60",
      win_rate: 0.64,
      average_roi: 0.22,
      total_profit_usd: 4_200_000,
      recent_opportunity_count: 18,
    },
    {
      wallet_address: "0x21a31ee1afc51d94c2efccaa2092ad1028285549",
      win_rate: 0.58,
      average_roi: 0.15,
      total_profit_usd: 1_850_000,
      recent_opportunity_count: 11,
    },
    {
      wallet_address: "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503",
      win_rate: 0.71,
      average_roi: 0.31,
      total_profit_usd: 6_100_000,
      recent_opportunity_count: 24,
    },
    {
      wallet_address: "0xd8da6bf26964af9d7eed9e03e53415dd37c80f66",
      win_rate: 0.61,
      average_roi: 0.19,
      total_profit_usd: 3_400_000,
      recent_opportunity_count: 15,
    },
    {
      wallet_address: "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be",
      win_rate: 0.55,
      average_roi: 0.12,
      total_profit_usd: 980_000,
      recent_opportunity_count: 9,
    },
    {
      wallet_address: "0x564286362092d8e7936f7749573a1fd9fde7abeb",
      win_rate: 0.67,
      average_roi: 0.27,
      total_profit_usd: 5_200_000,
      recent_opportunity_count: 21,
    },
    {
      wallet_address: "0x77696a7a2d7634ab4cfc9c96231e3c3d47cd14c8",
      win_rate: 0.59,
      average_roi: 0.16,
      total_profit_usd: 2_100_000,
      recent_opportunity_count: 13,
    },
    {
      wallet_address: "0xe92d1a43df510f82c66392592fb0c5c14ff92ea2",
      win_rate: 0.53,
      average_roi: 0.11,
      total_profit_usd: 720_000,
      recent_opportunity_count: 7,
    },
  ];
}

function fallbackSignals(): SignalDto[] {
  const now = new Date().toISOString();
  return [
    {
      id: -101,
      signal_type: "accumulation",
      token_symbol: "ETH",
      token_address: null,
      chain: "ethereum",
      title: "Smart-wallet accumulation cluster",
      description: "Elevated DEX buys from high-win-rate addresses (demo baseline).",
      signal_strength: 0.78,
      confidence_score: 82,
      source: "block70_intel",
      metadata_json: {},
      created_at: now,
    },
    {
      id: -102,
      signal_type: "liquidity",
      token_symbol: "SOL",
      token_address: null,
      chain: "solana",
      title: "Liquidity depth asymmetry",
      description: "Bid-side depth widening vs. thin asks — common pre-volatility structure.",
      signal_strength: 0.72,
      confidence_score: 76,
      source: "block70_intel",
      metadata_json: {},
      created_at: now,
    },
    {
      id: -103,
      signal_type: "narrative",
      token_symbol: "RNDR",
      token_address: null,
      chain: "ethereum",
      title: "Narrative momentum — compute / AI",
      description: "Cross-venue mention velocity rising; pairs with sector leader strength.",
      signal_strength: 0.69,
      confidence_score: 71,
      source: "block70_intel",
      metadata_json: {},
      created_at: now,
    },
    {
      id: -104,
      signal_type: "distribution",
      token_symbol: "BTC",
      token_address: null,
      chain: "bitcoin",
      title: "Exchange inflow cluster (illustrative)",
      description: "Short-term profit-taking signature into known venue deposit wallets.",
      signal_strength: 0.61,
      confidence_score: 68,
      source: "block70_intel",
      metadata_json: {},
      created_at: now,
    },
    {
      id: -105,
      signal_type: "funding",
      token_symbol: "DOGE",
      token_address: null,
      chain: "ethereum",
      title: "Perp funding dislocation",
      description: "Elevated positive funding vs spot drift — mean-reversion watch.",
      signal_strength: 0.58,
      confidence_score: 64,
      source: "block70_intel",
      metadata_json: {},
      created_at: now,
    },
    {
      id: -106,
      signal_type: "breakout",
      token_symbol: "LINK",
      token_address: null,
      chain: "ethereum",
      title: "Range breakout — volatility expansion",
      description: "Multi-day compression resolving with rising sponsor volume.",
      signal_strength: 0.63,
      confidence_score: 66,
      source: "block70_intel",
      metadata_json: {},
      created_at: now,
    },
  ];
}

function fallbackNews(): NewsIntelRow[] {
  const t = new Date().toISOString();
  return [
    {
      id: -201,
      title: "Institutional desks rotate toward quality large-caps as breadth improves",
      source: "Block70 Intel",
      url: "/news",
      aiSummary:
        "Flow commentary suggests risk-on appetite concentrated in liquid majors; watch ETH/BTC ratio and funding for confirmation.",
      narrativeImpact: 72,
      impactSentiment: "bullish",
      publishedAt: t,
    },
    {
      id: -202,
      title: "L2 fees compress again — sequencer revenue narratives back in focus",
      source: "Block70 Intel",
      url: "/chains",
      aiSummary:
        "Cost efficiency narratives can re-rate infra tokens short-term; pair with on-chain active-address trends.",
      narrativeImpact: 61,
      impactSentiment: "neutral",
      publishedAt: t,
    },
    {
      id: -203,
      title: "Stablecoin net inflows tick higher across CEX rails",
      source: "Block70 Intel",
      url: "/capitalflow",
      aiSummary:
        "Dry powder entering centralized venues often precedes volatility expansion within 48–96h.",
      narrativeImpact: 68,
      impactSentiment: "bullish",
      publishedAt: t,
    },
    {
      id: -204,
      title: "Perp funding flips positive on majors after balanced weekend",
      source: "Block70 Intel",
      url: "/insights",
      aiSummary:
        "Crowded short funding often mean-reverts; pair with open-interest deltas and spot premium.",
      narrativeImpact: 55,
      impactSentiment: "bullish",
      publishedAt: t,
    },
    {
      id: -205,
      title: "On-chain active addresses: L2 batches steady while L1 fees cool",
      source: "Block70 Intel",
      url: "/chains",
      aiSummary:
        "Fee compression can lift app-chain rotation trades; validate against bridge flows.",
      narrativeImpact: 49,
      impactSentiment: "neutral",
      publishedAt: t,
    },
    {
      id: -206,
      title: "RWA desk notes: tokenized treasury spread stable vs. off-chain bills",
      source: "Block70 Intel",
      url: "/narratives",
      aiSummary:
        "Basis stability reduces squeeze risk for yield carry; watch issuance calendars.",
      narrativeImpact: 44,
      impactSentiment: "neutral",
      publishedAt: t,
    },
  ];
}

/** Illustrative rows only when market endpoints return nothing — avoid implying live prices. */
const DEMO_GAINERS_LOSERS: { gainers: MoverRow[]; losers: MoverRow[] } = {
  gainers: [
    {
      symbol: "SOL",
      name: "Solana",
      slug: "solana",
      logoUrl: null,
      price: 142.5,
      change24h: 4.2,
      volume24h: 3.1e9,
      marketCap: 9.4e10,
    },
    {
      symbol: "AVAX",
      name: "Avalanche",
      slug: "avalanche-2",
      logoUrl: null,
      price: 36.2,
      change24h: 3.1,
      volume24h: 890e6,
      marketCap: 16e9,
    },
    {
      symbol: "SUI",
      name: "Sui",
      slug: "sui",
      logoUrl: null,
      price: 3.85,
      change24h: 2.6,
      volume24h: 620e6,
      marketCap: 11e9,
    },
    {
      symbol: "NEAR",
      name: "NEAR Protocol",
      slug: "near",
      logoUrl: null,
      price: 4.92,
      change24h: 2.2,
      volume24h: 410e6,
      marketCap: 5.8e9,
    },
    {
      symbol: "LINK",
      name: "Chainlink",
      slug: "chainlink",
      logoUrl: null,
      price: 18.4,
      change24h: 1.9,
      volume24h: 780e6,
      marketCap: 12e9,
    },
  ],
  losers: [
    {
      symbol: "DOGE",
      name: "Dogecoin",
      slug: "dogecoin",
      logoUrl: null,
      price: 0.162,
      change24h: -2.4,
      volume24h: 2.1e9,
      marketCap: 24e9,
    },
    {
      symbol: "SHIB",
      name: "Shiba Inu",
      slug: "shiba-inu",
      logoUrl: null,
      price: 0.000024,
      change24h: -1.9,
      volume24h: 410e6,
      marketCap: 14e9,
    },
    {
      symbol: "PEPE",
      name: "Pepe",
      slug: "pepe",
      logoUrl: null,
      price: 0.0000092,
      change24h: -3.1,
      volume24h: 890e6,
      marketCap: 3.8e9,
    },
    {
      symbol: "WIF",
      name: "dogwifhat",
      slug: "dogwifcoin",
      logoUrl: null,
      price: 1.85,
      change24h: -2.8,
      volume24h: 320e6,
      marketCap: 1.9e9,
    },
    {
      symbol: "BONK",
      name: "Bonk",
      slug: "bonk",
      logoUrl: null,
      price: 0.000022,
      change24h: -2.2,
      volume24h: 280e6,
      marketCap: 1.5e9,
    },
  ],
};

function fallbackCategories(): CategoryDirectoryApiItem[] {
  return [
    {
      id: "ai-big-data",
      name: "AI & Data",
      market_cap: 42e9,
      market_cap_change_24h: 2.1,
      volume_24h: 2.8e9,
      trend: "bullish",
      capital_flow: "in",
      vol_to_mcap: 0.12,
      avg_block70: 62,
      avg_change_24h: 2.1,
      coin_count: 48,
      top3: [
        { slug: "fetch-ai", name: "Artificial Superintelligence Alliance", symbol: "FET", change24hPct: 3.2, block70Score: 68 },
        { slug: "render-token", name: "Render", symbol: "RNDR", change24hPct: 2.4, block70Score: 71 },
        { slug: "ocean-protocol", name: "Ocean Protocol", symbol: "OCEAN", change24hPct: 1.8, block70Score: 59 },
      ],
    },
    {
      id: "rwa",
      name: "RWA & Yield",
      market_cap: 8.2e9,
      market_cap_change_24h: -0.6,
      volume_24h: 410e6,
      trend: "neutral",
      capital_flow: "neutral",
      vol_to_mcap: 0.05,
      avg_block70: 55,
      avg_change_24h: -0.6,
      coin_count: 22,
      top3: [
        { slug: "ondo-finance", name: "Ondo", symbol: "ONDO", change24hPct: 0.9, block70Score: 64 },
        { slug: "centrifuge", name: "Centrifuge", symbol: "CFG", change24hPct: -0.4, block70Score: 52 },
        { slug: "maple", name: "Maple", symbol: "MPL", change24hPct: 0.2, block70Score: 51 },
      ],
    },
    {
      id: "depin",
      name: "DePIN",
      market_cap: 14e9,
      market_cap_change_24h: 1.4,
      volume_24h: 1.1e9,
      trend: "bullish",
      capital_flow: "in",
      vol_to_mcap: 0.08,
      avg_block70: 58,
      avg_change_24h: 1.4,
      coin_count: 31,
      top3: [
        { slug: "helium", name: "Helium", symbol: "HNT", change24hPct: 2.1, block70Score: 57 },
        { slug: "akash-network", name: "Akash", symbol: "AKT", change24hPct: 1.2, block70Score: 54 },
        { slug: "render-token", name: "Render", symbol: "RNDR", change24hPct: 2.4, block70Score: 71 },
      ],
    },
    {
      id: "defi-bluechips",
      name: "DeFi Bluechips",
      market_cap: 52e9,
      market_cap_change_24h: 1.2,
      volume_24h: 3.2e9,
      trend: "bullish",
      capital_flow: "in",
      vol_to_mcap: 0.062,
      avg_block70: 64,
      avg_change_24h: 1.2,
      coin_count: 36,
      top3: [
        { slug: "uniswap", name: "Uniswap", symbol: "UNI", change24hPct: 1.5, block70Score: 66 },
        { slug: "aave", name: "Aave", symbol: "AAVE", change24hPct: 0.9, block70Score: 63 },
        { slug: "curve-dao-token", name: "Curve", symbol: "CRV", change24hPct: -0.3, block70Score: 54 },
      ],
    },
    {
      id: "layer-1",
      name: "Layer 1s",
      market_cap: 880e9,
      market_cap_change_24h: 0.9,
      volume_24h: 22e9,
      trend: "bullish",
      capital_flow: "neutral",
      vol_to_mcap: 0.025,
      avg_block70: 58,
      avg_change_24h: 0.9,
      coin_count: 24,
      top3: [
        { slug: "ethereum", name: "Ethereum", symbol: "ETH", change24hPct: 0.8, block70Score: 61 },
        { slug: "solana", name: "Solana", symbol: "SOL", change24hPct: 2.1, block70Score: 64 },
        { slug: "sui", name: "Sui", symbol: "SUI", change24hPct: 1.1, block70Score: 59 },
      ],
    },
    {
      id: "infra",
      name: "Infrastructure",
      market_cap: 18e9,
      market_cap_change_24h: -0.4,
      volume_24h: 720e6,
      trend: "neutral",
      capital_flow: "out",
      vol_to_mcap: 0.04,
      avg_block70: 51,
      avg_change_24h: -0.4,
      coin_count: 41,
      top3: [
        { slug: "chainlink", name: "Chainlink", symbol: "LINK", change24hPct: 0.4, block70Score: 58 },
        { slug: "the-graph", name: "The Graph", symbol: "GRT", change24hPct: -0.8, block70Score: 47 },
        { slug: "polygon-ecosystem-token", name: "Polygon", symbol: "POL", change24hPct: -0.2, block70Score: 52 },
      ],
    },
    {
      id: "meme-token",
      name: "Meme coins",
      market_cap: 48e9,
      market_cap_change_24h: -1.8,
      volume_24h: 6e9,
      trend: "bearish",
      capital_flow: "out",
      vol_to_mcap: 0.125,
      avg_block70: 44,
      avg_change_24h: -1.8,
      coin_count: 28,
      top3: [
        { slug: "dogecoin", name: "Dogecoin", symbol: "DOGE", change24hPct: -1.2, block70Score: 48 },
        { slug: "shiba-inu", name: "Shiba Inu", symbol: "SHIB", change24hPct: -0.9, block70Score: 45 },
        { slug: "pepe", name: "Pepe", symbol: "PEPE", change24hPct: -2.4, block70Score: 42 },
      ],
    },
    {
      id: "store-of-value",
      name: "Store of value",
      market_cap: 1.9e12,
      market_cap_change_24h: 0.15,
      volume_24h: 42e9,
      trend: "neutral",
      capital_flow: "neutral",
      vol_to_mcap: 0.022,
      avg_block70: 54,
      avg_change_24h: 0.15,
      coin_count: 6,
      top3: [
        { slug: "bitcoin", name: "Bitcoin", symbol: "BTC", change24hPct: 0.2, block70Score: 56 },
        { slug: "bitcoin-cash", name: "Bitcoin Cash", symbol: "BCH", change24hPct: -0.1, block70Score: 49 },
        { slug: "litecoin", name: "Litecoin", symbol: "LTC", change24hPct: 0.05, block70Score: 50 },
      ],
    },
    {
      id: "gaming-metaverse",
      name: "Gaming & Metaverse",
      market_cap: 11e9,
      market_cap_change_24h: 0.8,
      volume_24h: 1.4e9,
      trend: "bullish",
      capital_flow: "in",
      vol_to_mcap: 0.11,
      avg_block70: 57,
      avg_change_24h: 0.8,
      coin_count: 42,
      top3: [
        { slug: "immutable-x", name: "Immutable", symbol: "IMX", change24hPct: 1.1, block70Score: 55 },
        { slug: "axie-infinity", name: "Axie Infinity", symbol: "AXS", change24hPct: 0.4, block70Score: 48 },
        { slug: "gala", name: "Gala", symbol: "GALA", change24hPct: 0.9, block70Score: 51 },
      ],
    },
    {
      id: "privacy",
      name: "Privacy",
      market_cap: 2.8e9,
      market_cap_change_24h: -0.9,
      volume_24h: 180e6,
      trend: "neutral",
      capital_flow: "neutral",
      vol_to_mcap: 0.064,
      avg_block70: 49,
      avg_change_24h: -0.9,
      coin_count: 14,
      top3: [
        { slug: "zcash", name: "Zcash", symbol: "ZEC", change24hPct: -0.5, block70Score: 46 },
        { slug: "monero", name: "Monero", symbol: "XMR", change24hPct: 0.2, block70Score: 52 },
        { slug: "oasis-network", name: "Oasis", symbol: "ROSE", change24hPct: -1.2, block70Score: 44 },
      ],
    },
    {
      id: "lsd-staking",
      name: "Liquid staking",
      market_cap: 28e9,
      market_cap_change_24h: 0.5,
      volume_24h: 920e6,
      trend: "bullish",
      capital_flow: "in",
      vol_to_mcap: 0.033,
      avg_block70: 60,
      avg_change_24h: 0.5,
      coin_count: 18,
      top3: [
        { slug: "lido-dao", name: "Lido", symbol: "LDO", change24hPct: 0.6, block70Score: 58 },
        { slug: "rocket-pool", name: "Rocket Pool", symbol: "RPL", change24hPct: 0.3, block70Score: 54 },
        { slug: "stakewise", name: "StakeWise", symbol: "SWISE", change24hPct: -0.2, block70Score: 50 },
      ],
    },
    {
      id: "derivatives-perps",
      name: "Derivatives & perps",
      market_cap: 6.2e9,
      market_cap_change_24h: 1.1,
      volume_24h: 2.1e9,
      trend: "bullish",
      capital_flow: "in",
      vol_to_mcap: 0.29,
      avg_block70: 56,
      avg_change_24h: 1.1,
      coin_count: 24,
      top3: [
        { slug: "hyperliquid", name: "Hyperliquid", symbol: "HYPE", change24hPct: 2.2, block70Score: 62 },
        { slug: "jupiter-exchange-solana", name: "Jupiter", symbol: "JUP", change24hPct: 0.8, block70Score: 55 },
        { slug: "gmx", name: "GMX", symbol: "GMX", change24hPct: 0.4, block70Score: 53 },
      ],
    },
    {
      id: "interop-bridges",
      name: "Interoperability",
      market_cap: 9e9,
      market_cap_change_24h: 0.35,
      volume_24h: 550e6,
      trend: "neutral",
      capital_flow: "neutral",
      vol_to_mcap: 0.061,
      avg_block70: 53,
      avg_change_24h: 0.35,
      coin_count: 33,
      top3: [
        { slug: "cosmos", name: "Cosmos", symbol: "ATOM", change24hPct: 0.2, block70Score: 51 },
        { slug: "layerzero", name: "LayerZero", symbol: "ZRO", change24hPct: 0.9, block70Score: 56 },
        { slug: "wormhole", name: "Wormhole", symbol: "W", change24hPct: -0.3, block70Score: 48 },
      ],
    },
    {
      id: "payments-stable",
      name: "Payments & stables",
      market_cap: 140e9,
      market_cap_change_24h: 0.05,
      volume_24h: 45e9,
      trend: "neutral",
      capital_flow: "neutral",
      vol_to_mcap: 0.032,
      avg_block70: 52,
      avg_change_24h: 0.05,
      coin_count: 52,
      top3: [
        { slug: "tether", name: "Tether", symbol: "USDT", change24hPct: 0.01, block70Score: 55 },
        { slug: "usd-coin", name: "USDC", symbol: "USDC", change24hPct: 0.0, block70Score: 54 },
        { slug: "dai", name: "DAI", symbol: "DAI", change24hPct: 0.02, block70Score: 53 },
      ],
    },
  ];
}

function hashToJitter(id: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 17) - 8;
}

function categoryToNarrativeRow(c: CategoryDirectoryApiItem): NarrativeEngineRow {
  const b70 = typeof c.avg_block70 === "number" && Number.isFinite(c.avg_block70) ? c.avg_block70 : 52;
  const mcapCh =
    typeof c.market_cap_change_24h === "number" && Number.isFinite(c.market_cap_change_24h)
      ? c.market_cap_change_24h
      : null;
  const avgCh = typeof c.avg_change_24h === "number" && Number.isFinite(c.avg_change_24h) ? c.avg_change_24h : 0;
  const flowAdj =
    c.capital_flow === "in" ? 6 : c.capital_flow === "out" ? -8 : 0;
  const trendAdj = c.trend === "bullish" ? 5 : c.trend === "bearish" ? -12 : -2;
  const volAdj = Math.round(Math.min(12, (c.vol_to_mcap ?? 0) * 80));
  const mcapAdj = mcapCh != null ? Math.round(Math.max(-18, Math.min(22, mcapCh * 1.4))) : Math.round(avgCh * 2.2);
  const jitter = hashToJitter(c.id, c.name.length);
  let sentimentScore = Math.round(
    Math.max(-88, Math.min(92, b70 * 0.55 + flowAdj + trendAdj + volAdj * 0.35 + mcapAdj + jitter)),
  );
  if (c.trend === "bearish" && sentimentScore > 15) sentimentScore = 15;
  if (c.trend === "bullish" && sentimentScore < 8) sentimentScore = 8 + Math.abs(jitter % 5);

  return {
    id: c.id,
    name: c.name,
    sentimentScore,
    trend: c.trend,
    capitalFlow: c.capital_flow,
    volToMcap: c.vol_to_mcap,
    avgChange24h: c.avg_change_24h ?? null,
    topSymbols: c.top3?.map((t) => t.symbol) ?? c.top_coins?.map((x) => x.symbol) ?? [],
  };
}

function mapHeatmapEntry(c: MarketCoin) {
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

/** Homepage treemap: five strongest gainers and five weakest losers (deduped), max 10 tiles. */
function buildHomeHeatmapCoins(coins: MarketCoin[]) {
  const v = dashboardMarketCoins(coins);
  if (!v.length) return [];
  const seen = new Set<string>();
  const gainers = [...v]
    .filter((c) => (c.change_24h ?? 0) > 0)
    .sort((a, b) => (b.change_24h ?? 0) - (a.change_24h ?? 0));
  const losers = [...v]
    .filter((c) => (c.change_24h ?? 0) < 0)
    .sort((a, b) => (a.change_24h ?? 0) - (b.change_24h ?? 0));
  const out: MarketCoin[] = [];
  for (const c of gainers) {
    if (out.length >= 5) break;
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    out.push(c);
  }
  for (const c of losers) {
    if (out.length >= 10) break;
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    out.push(c);
  }
  if (out.length < 10) {
    const byMcap = [...v]
      .filter((c) => !seen.has(c.slug))
      .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0));
    for (const c of byMcap) {
      if (out.length >= 10) break;
      seen.add(c.slug);
      out.push(c);
    }
  }
  return out.map(mapHeatmapEntry);
}

/** When treemap filters leave nothing (e.g. all flat 24h), still show real prices by mcap. */
function heatmapEntriesTopByMcap(coins: MarketCoin[]): ReturnType<typeof mapHeatmapEntry>[] {
  const v = dashboardMarketCoins(coins);
  return [...v]
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
    .slice(0, 10)
    .map(mapHeatmapEntry);
}

function mapMoverRow(c: MarketCoin): MoverRow {
  return {
    symbol: c.symbol,
    name: c.name,
    slug: c.slug,
    logoUrl: c.logo_url ?? null,
    price: c.price ?? 0,
    change24h: c.change_24h ?? 0,
    volume24h: c.volume ?? 0,
    marketCap: c.market_cap ?? 0,
  };
}

export async function buildHomeDashboard(): Promise<HomeDashboardPayload> {
  const generatedAt = new Date().toISOString();

  const [
    summaryRes,
    marketListRes,
    trendingRes,
    signalsRes,
    walletsRes,
    newsRes,
    oppsRes,
    categoriesRes,
    insightsRes,
    scannerRes,
    cgBundleRes,
  ] = await Promise.allSettled([
    withTimeout(getMarketSummary(0), FETCH_MS),
    withTimeout(getMarketCoins({ limit: 120, page: 1 }), FETCH_MS),
    withTimeout(getSignalsTrending({ hours: 24, limit: 14 }), FETCH_MS),
    withTimeout(getSignalsLatest({ limit: 24 }), FETCH_MS),
    withTimeout(getWalletLeaderboard(), FETCH_MS),
    withTimeout(getNewsArticles({ limit: 12 }), FETCH_MS),
    withTimeout(getOpportunities(), FETCH_MS),
    withTimeout(getCategoryDirectory({ limit: 40, order: "market_cap" }), FETCH_MS),
    withTimeout(getInsightsTrending(), FETCH_MS),
    withTimeout(loadCoinsPageData({ limit: 120, offset: 0 }), COINS_PAGE_FETCH_MS),
    /** Always in parallel (same as `/market` macro build) — conditional fetch was too easy to starve hero. */
    withTimeout(fetchCoingeckoHomeMarketBundle(100), CG_FETCH_MS),
  ]);

  let marketCoins: MarketCoin[] = [];
  let marketAsOf: string | undefined;
  let marketSource: string | undefined;
  let globalMcap: number | null = null;
  let globalVol: number | null = null;
  let btcDom: number | null = null;
  let ethDom: number | null = null;

  if (summaryRes.status === "fulfilled" && summaryRes.value) {
    const s = summaryRes.value;
    marketCoins = s.top ?? [];
    marketAsOf = s.as_of;
    marketSource = s.source;
    const g = s.global;
    globalMcap = toFiniteNumber(g?.total_market_cap_usd);
    globalVol = toFiniteNumber(g?.total_volume_usd);
    btcDom = toFiniteNumber(g?.btc_dominance_pct);
    ethDom = toFiniteNumber(g?.eth_dominance_pct);
  }

  let vk: MarketCoin[] = [];
  if (scannerRes.status === "fulfilled" && scannerRes.value.items.length) {
    vk = dashboardMarketCoins(traderScannerRowsToMarketCoins(scannerRes.value.items));
  }
  if (!vk.length && marketListRes.status === "fulfilled" && marketListRes.value.length) {
    vk = dashboardMarketCoins(marketListRes.value);
  }
  if (!vk.length) {
    vk = dashboardMarketCoins(marketCoins);
  }
  if (!vk.length) {
    try {
      const alt = await withTimeout(getMarketCoins({ limit: 120, page: 1 }), FETCH_MS);
      vk = dashboardMarketCoins(alt);
    } catch {
      vk = [];
    }
  }

  let marketSourceNote = marketSource;
  /** CoinGecko bundle loaded in parallel with summary (aligned with `buildMacroDashboard`). */
  let cgCoinsRaw: MarketCoin[] = [];
  const cg =
    cgBundleRes.status === "fulfilled" && cgBundleRes.value
      ? cgBundleRes.value
      : { global: null as CoingeckoGlobalNumbers | null, coins: [] as MarketCoin[] };
  if (cg.coins.length) cgCoinsRaw = cg.coins;

  const gn = cg.global;
  let usedCoingeckoGlobal = false;
  if (gn) {
    if (globalMcap == null || globalMcap <= 0) {
      const v = toFiniteNumber(gn.total_market_cap_usd);
      if (v != null && v > 0) {
        globalMcap = v;
        usedCoingeckoGlobal = true;
      }
    }
    if (globalVol == null || globalVol <= 0) {
      const v = toFiniteNumber(gn.total_volume_usd);
      if (v != null && v > 0) {
        globalVol = v;
        usedCoingeckoGlobal = true;
      }
    }
    if (btcDom == null && gn.btc_dominance_pct != null) {
      const v = toFiniteNumber(gn.btc_dominance_pct);
      if (v != null) {
        btcDom = v;
        usedCoingeckoGlobal = true;
      }
    }
    if (ethDom == null && gn.eth_dominance_pct != null) {
      const v = toFiniteNumber(gn.eth_dominance_pct);
      if (v != null) {
        ethDom = v;
        usedCoingeckoGlobal = true;
      }
    }
  }
  if (usedCoingeckoGlobal) {
    marketSourceNote = marketSourceNote ? `${marketSourceNote}+coingecko` : "coingecko-direct";
  }

  if (!vk.length && cgCoinsRaw.length) vk = dashboardMarketCoins(cgCoinsRaw);

  const heroMetrics: HeroMetricsMutable = {
    totalMarketCapUsd: globalMcap,
    volume24hUsd: globalVol,
    btcDominancePct: btcDom,
    ethDominancePct: ethDom,
  };
  const usedCgListForHero = cgCoinsRaw.length > 0;
  const heroFillCoins = usedCgListForHero ? cgCoinsRaw : vk;
  fillHeroMetricsFromCoinUniverse(heroFillCoins, heroMetrics);
  if (
    usedCgListForHero &&
    vk.length &&
    (heroMetrics.totalMarketCapUsd == null ||
      heroMetrics.volume24hUsd == null ||
      heroMetrics.btcDominancePct == null ||
      heroMetrics.ethDominancePct == null)
  ) {
    fillHeroMetricsFromCoinUniverse(vk, heroMetrics);
  }
  globalMcap = heroMetrics.totalMarketCapUsd;
  globalVol = heroMetrics.volume24hUsd;
  btcDom = heroMetrics.btcDominancePct;
  ethDom = heroMetrics.ethDominancePct;

  /** Macro dashboard also derives dominance from the tape when globals are missing or zero. */
  let btcPct = btcDom ?? 0;
  let ethPct = ethDom ?? 0;
  const domTape = dashboardMarketCoins(cgCoinsRaw.length ? cgCoinsRaw : vk);
  if ((!btcPct || !ethPct) && domTape.length) {
    const t = domTape.reduce((s, c) => s + (c.market_cap ?? 0), 0);
    if (t > 0) {
      const btcRow =
        domTape.find((c) => (c.symbol || "").toUpperCase() === "BTC") ||
        domTape.find((c) => (c.slug || "").toLowerCase() === "bitcoin");
      const ethRow =
        domTape.find((c) => (c.symbol || "").toUpperCase() === "ETH") ||
        domTape.find((c) => (c.slug || "").toLowerCase() === "ethereum");
      if (!btcPct && btcRow && (btcRow.market_cap ?? 0) > 0) {
        btcPct = ((btcRow.market_cap ?? 0) / t) * 100;
      }
      if (!ethPct && ethRow && (ethRow.market_cap ?? 0) > 0) {
        ethPct = ((ethRow.market_cap ?? 0) / t) * 100;
      }
    }
  }
  if (btcDom == null && btcPct > 0) btcDom = btcPct;
  if (ethDom == null && ethPct > 0) ethDom = ethPct;

  const sent = sentimentFromCoins(vk);

  let categoryItems: CategoryDirectoryApiItem[] =
    categoriesRes.status === "fulfilled" ? categoriesRes.value.items : [];
  if (!categoryItems.length) {
    categoryItems = fallbackCategories();
  } else if (categoryItems.length < 15) {
    const seen = new Set(categoryItems.map((x) => x.id));
    for (const c of fallbackCategories()) {
      if (categoryItems.length >= 15) break;
      if (!seen.has(c.id)) {
        categoryItems.push(c);
        seen.add(c.id);
      }
    }
  }

  const narrativesFull = categoryItems.slice(0, 8).map(categoryToNarrativeRow);
  const topNarratives: HeroNarrativeChip[] = categoryItems.slice(0, 15).map((c) => ({
    id: c.id,
    name: c.name,
    trend: c.trend,
    capitalFlow: c.capital_flow,
  }));

  const gainers = [...vk]
    .sort((a, b) => (b.change_24h ?? -Infinity) - (a.change_24h ?? -Infinity))
    .slice(0, 5)
    .map(mapMoverRow);
  const losers = [...vk]
    .sort((a, b) => (a.change_24h ?? Infinity) - (b.change_24h ?? Infinity))
    .slice(0, 5)
    .map(mapMoverRow);

  const heatmapFromGainersLosers = vk.length ? buildHomeHeatmapCoins(vk) : [];
  const heatmapCoins =
    heatmapFromGainersLosers.length > 0
      ? heatmapFromGainersLosers
      : vk.length > 0
        ? heatmapEntriesTopByMcap(vk)
        : [...DEMO_GAINERS_LOSERS.gainers, ...DEMO_GAINERS_LOSERS.losers].map((r) => ({
            symbol: r.symbol,
            name: r.name,
            slug: r.slug,
            logoUrl: r.logoUrl,
            price: r.price,
            change24h: r.change24h,
            marketCap: r.marketCap,
            volume24h: r.volume24h,
          }));

  const volumeSpikes: VolumeSpikeRow[] = [...vk]
    .filter((c) => (c.market_cap ?? 0) > 0)
    .map((c) => {
      const mcap = c.market_cap ?? 1;
      const vol = c.volume ?? 0;
      return {
        symbol: c.symbol,
        name: c.name,
        slug: c.slug,
        logoUrl: c.logo_url ?? null,
        volume24h: vol,
        marketCap: mcap,
        volToMcap: vol / mcap,
        change24h: c.change_24h ?? 0,
      };
    })
    .sort((a, b) => b.volToMcap - a.volToMcap)
    .slice(0, 18);

  let wallets: WalletLeaderboardEntry[] =
    walletsRes.status === "fulfilled" ? walletsRes.value : [];
  if (!wallets.length) wallets = fallbackWallets();

  const flows: SmartMoneyFlow[] = [
    {
      label: "CEX positioning (synthetic)",
      direction: sent.label === "bearish" ? "out" : "in",
      amountLabel: sent.label === "bearish" ? "$180M" : "$420M",
      detail: "Aggregate risk-on proxy when chain feeds are quiet; refine with live flows.",
    },
    {
      label: "Whale clip — 24h window",
      direction: "in",
      amountLabel: "$64M",
      detail: "Large clips across liquid majors (illustrative pulse).",
    },
    {
      label: "Bridge exits",
      direction: "out",
      amountLabel: "$31M",
      detail: "Secondary-chain profit taking (illustrative pulse).",
    },
  ];

  let signals: SignalDto[] = signalsRes.status === "fulfilled" ? signalsRes.value : [];
  if (!signals.length) {
    signals = fallbackSignals();
  } else {
    const seen = new Set(signals.map((s) => s.id));
    for (const s of fallbackSignals()) {
      if (signals.length >= 6) break;
      if (!seen.has(s.id)) {
        signals.push(s);
        seen.add(s.id);
      }
    }
  }
  signals = signals.slice(0, 6);

  let newsRaw: NewsArticleSummary[] = newsRes.status === "fulfilled" ? newsRes.value : [];
  let news: NewsIntelRow[] = newsRaw.map((item) => {
    const { sentimentLabel } = sentimentForNews(item);
    return {
      id: item.id,
      title: item.title,
      source: item.source,
      url: item.url,
      aiSummary: aiSummaryForNews(item),
      narrativeImpact: narrativeImpactFromNews(item),
      impactSentiment: sentimentLabel,
      publishedAt: item.published_at ?? null,
    };
  });
  if (!news.length) news = fallbackNews();

  let opportunities: Opportunity[] = oppsRes.status === "fulfilled" ? oppsRes.value : [];
  opportunities = [...opportunities]
    .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
    .slice(0, 6);
  if (!opportunities.length) {
    const t = new Date().toISOString();
    opportunities = [
      {
        id: -301,
        title: "ETH–BTC ratio reclaim watch",
        slug: "eth-btc-ratio-watch",
        type: "rotation",
        chain: "ethereum",
        status: "active",
        summary: "If majors mean-revert with ETH leading, L2 & DeFi beta historically overshoots.",
        thesis: "Pair trade risk-on sleeve vs. BTC hedge; size for vol.",
        asset_symbol: "ETH",
        base_symbol: "ETH",
        quote_symbol: "USD",
        source: "block70_intel",
        source_ref: null,
        estimated_cost: null,
        estimated_upside: null,
        estimated_roi_percent: null,
        confidence_score: 72,
        upside_score: 68,
        freshness_score: 80,
        liquidity_score: 74,
        accessibility_score: 70,
        risk_score: 42,
        difficulty_score: 35,
        total_score: 76,
        risk_level: "medium",
        difficulty_level: "intermediate",
        detected_at: t,
        expires_at: null,
        last_seen_at: t,
        created_at: t,
        updated_at: t,
        raw_payload: null,
      },
      {
        id: -302,
        title: "Solana perp basis compression",
        slug: "sol-perp-basis",
        type: "arbitrage",
        chain: "solana",
        status: "active",
        summary: "Tight basis with rising OI — often resolves with a directional impulse.",
        thesis: "Monitor funding + OI delta before scaling.",
        asset_symbol: "SOL",
        base_symbol: "SOL",
        quote_symbol: "USD",
        source: "block70_intel",
        source_ref: null,
        estimated_cost: null,
        estimated_upside: null,
        estimated_roi_percent: null,
        confidence_score: 64,
        upside_score: 71,
        freshness_score: 76,
        liquidity_score: 69,
        accessibility_score: 62,
        risk_score: 55,
        difficulty_score: 48,
        total_score: 71,
        risk_level: "medium",
        difficulty_level: "advanced",
        detected_at: t,
        expires_at: null,
        last_seen_at: t,
        created_at: t,
        updated_at: t,
        raw_payload: null,
      },
      {
        id: -303,
        title: "Liquid staking discount vs. native stake yield",
        slug: "lst-discount-yield",
        type: "arbitrage",
        chain: "ethereum",
        status: "active",
        summary:
          "When LST trade-off bps widen, mean-reversion often pairs with queue times — watch epoch boundaries.",
        thesis: "Carry vs. basis — size smaller until redemption clarity improves.",
        asset_symbol: "ETH",
        base_symbol: "ETH",
        quote_symbol: "USD",
        source: "block70_intel",
        source_ref: null,
        estimated_cost: null,
        estimated_upside: null,
        estimated_roi_percent: null,
        confidence_score: 58,
        upside_score: 62,
        freshness_score: 74,
        liquidity_score: 78,
        accessibility_score: 66,
        risk_score: 48,
        difficulty_score: 52,
        total_score: 67,
        risk_level: "medium",
        difficulty_level: "intermediate",
        detected_at: t,
        expires_at: null,
        last_seen_at: t,
        created_at: t,
        updated_at: t,
        raw_payload: null,
      },
    ];
  }

  let insightHeadline: string | null = null;
  if (insightsRes.status === "fulfilled" && insightsRes.value?.trends?.length) {
    const t = insightsRes.value.trends[0];
    const mag =
      typeof t.magnitude === "number" ? (t.magnitude > 0 ? "+" : "") + t.magnitude.toFixed(1) : "";
    insightHeadline = `${t.category}: ${t.key}${mag ? ` (${mag})` : ""}`;
  } else if (trendingRes.status === "fulfilled" && trendingRes.value.length) {
    const tr = trendingRes.value[0];
    insightHeadline = `Signal density: ${tr.token_symbol ?? "market"} · ${tr.signal_count} hits`;
  }

  const heroMcap = globalMcap;
  const heroVol = globalVol;
  const heroBtc = btcDom;
  const heroEth = ethDom;

  return {
    meta: {
      generatedAt,
      cacheTtlSec: HOME_DASHBOARD_CACHE_SEC,
      marketSource: marketSourceNote ?? marketSource,
      marketAsOf,
    },
    hero: {
      totalMarketCapUsd: heroMcap,
      volume24hUsd: heroVol,
      btcDominancePct: heroBtc,
      ethDominancePct: heroEth,
      sentiment: sent.label,
      sentimentScore: sent.score,
      topNarratives,
      insightHeadline,
    },
      market: {
      gainers: gainers.length ? gainers : DEMO_GAINERS_LOSERS.gainers,
      losers: losers.length ? losers : DEMO_GAINERS_LOSERS.losers,
      heatmap: heatmapCoins,
      volumeSpikes: volumeSpikes.length
        ? volumeSpikes
        : [...DEMO_GAINERS_LOSERS.gainers, ...DEMO_GAINERS_LOSERS.losers]
            .map((r) => {
              const mcap = Math.max(r.marketCap, 1);
              return {
                symbol: r.symbol,
                name: r.name,
                slug: r.slug,
                logoUrl: r.logoUrl,
                volume24h: r.volume24h,
                marketCap: mcap,
                volToMcap: r.volume24h / mcap,
                change24h: r.change24h,
              };
            })
            .sort((a, b) => b.volToMcap - a.volToMcap),
    },
    narratives: narrativesFull.length ? narrativesFull : fallbackCategories().map(categoryToNarrativeRow),
    smartMoney: { wallets, flows },
    signals: signals.slice(0, 6),
    news: news.slice(0, 8),
    opportunities,
  };
}
