/**
 * Aggregates all home “command center” data in one builder (used by GET /api/home/dashboard).
 * Always returns a full payload — live API when available, curated fallbacks when not.
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
import { withTimeout } from "@/lib/with-timeout";
import type { Opportunity, SignalDto, WalletLeaderboardEntry } from "@/lib/types";

export const HOME_DASHBOARD_CACHE_SEC = 15;
const FETCH_MS = 8_000;

export type HeroNarrativeChip = {
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

function validCoins(coins: MarketCoin[]) {
  return coins.filter(
    (c) =>
      typeof c.price === "number" &&
      typeof c.market_cap === "number" &&
      typeof c.volume === "number" &&
      typeof c.change_24h === "number",
  );
}

function sentimentFromCoins(coins: MarketCoin[]): {
  label: "bullish" | "bearish" | "neutral";
  score: number;
} {
  const v = validCoins(coins).slice(0, 24);
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
      publishedAt: t,
    },
    {
      id: -203,
      title: "Stablecoin net inflows tick higher across CEX rails",
      source: "Block70 Intel",
      url: "/flows",
      aiSummary:
        "Dry powder entering centralized venues often precedes volatility expansion within 48–96h.",
      narrativeImpact: 68,
      publishedAt: t,
    },
  ];
}

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
  ];
}

function narrativeImpactFromNews(item: NewsArticleSummary): number {
  const base = item.title.length + (item.summary?.length ?? 0);
  const tagBoost = (item.tags?.length ?? 0) * 7;
  const n = 48 + (base % 37) + tagBoost;
  return Math.max(38, Math.min(94, n));
}

function aiSummaryForNews(item: NewsArticleSummary): string {
  if (item.summary && item.summary.length > 20) {
    const s = item.summary.replace(/\s+/g, " ").trim();
    return s.length > 200 ? `${s.slice(0, 197)}…` : s;
  }
  return `Headline watch: ${item.title.slice(0, 120)}${item.title.length > 120 ? "…" : ""}`;
}

function categoryToNarrativeRow(c: CategoryDirectoryApiItem): NarrativeEngineRow {
  const sentimentScore =
    c.trend === "bullish" ? 58 : c.trend === "bearish" ? -52 : 12;
  return {
    id: c.id,
    name: c.name,
    sentimentScore: sentimentScore + Math.round((c.avg_change_24h ?? 0) * 3),
    trend: c.trend,
    capitalFlow: c.capital_flow,
    volToMcap: c.vol_to_mcap,
    avgChange24h: c.avg_change_24h ?? null,
    topSymbols: c.top3?.map((t) => t.symbol) ?? c.top_coins?.map((x) => x.symbol) ?? [],
  };
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
    trendingRes,
    signalsRes,
    walletsRes,
    newsRes,
    oppsRes,
    categoriesRes,
    insightsRes,
  ] = await Promise.allSettled([
    withTimeout(getMarketSummary(40), FETCH_MS),
    withTimeout(getSignalsTrending({ hours: 24, limit: 14 }), FETCH_MS),
    withTimeout(getSignalsLatest({ limit: 12 }), FETCH_MS),
    withTimeout(getWalletLeaderboard(), FETCH_MS),
    withTimeout(getNewsArticles({ limit: 10 }), FETCH_MS),
    withTimeout(getOpportunities(), FETCH_MS),
    withTimeout(getCategoryDirectory({ limit: 24, order: "market_cap" }), FETCH_MS),
    withTimeout(getInsightsTrending(), FETCH_MS),
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
    globalMcap = g?.total_market_cap_usd ?? null;
    globalVol = g?.total_volume_usd ?? null;
    btcDom = g?.btc_dominance_pct ?? null;
    ethDom = g?.eth_dominance_pct ?? null;
  }

  let vk = validCoins(marketCoins);
  if (!vk.length) {
    try {
      const alt = await withTimeout(getMarketCoins({ limit: 48, page: 1 }), FETCH_MS);
      vk = validCoins(alt);
    } catch {
      vk = [];
    }
  }

  if (globalMcap == null && vk.length) {
    globalMcap = vk.reduce((s, c) => s + (c.market_cap ?? 0), 0);
    globalVol = vk.reduce((s, c) => s + (c.volume ?? 0), 0);
    const btc = vk.find((c) => (c.symbol || "").toUpperCase() === "BTC");
    const eth = vk.find((c) => (c.symbol || "").toUpperCase() === "ETH");
    const sc = globalMcap > 0 ? globalMcap : 1;
    btcDom = btc?.market_cap != null ? (btc.market_cap / sc) * 100 : btcDom;
    ethDom = eth?.market_cap != null ? (eth.market_cap / sc) * 100 : ethDom;
  }

  const sent = sentimentFromCoins(vk);

  let categoryItems: CategoryDirectoryApiItem[] =
    categoriesRes.status === "fulfilled" ? categoriesRes.value.items : [];
  if (!categoryItems.length) {
    categoryItems = fallbackCategories();
  }

  const narrativesFull = categoryItems.slice(0, 8).map(categoryToNarrativeRow);
  const topNarratives: HeroNarrativeChip[] = categoryItems.slice(0, 3).map((c) => ({
    name: c.name,
    trend: c.trend,
    capitalFlow: c.capital_flow,
  }));

  const gainers = [...vk]
    .sort((a, b) => (b.change_24h ?? -Infinity) - (a.change_24h ?? -Infinity))
    .slice(0, 10)
    .map(mapMoverRow);
  const losers = [...vk]
    .sort((a, b) => (a.change_24h ?? Infinity) - (b.change_24h ?? Infinity))
    .slice(0, 10)
    .map(mapMoverRow);

  const heatmapCoins = vk.slice(0, 48).map((c) => ({
    symbol: c.symbol,
    name: c.name,
    slug: c.slug,
    logoUrl: c.logo_url ?? null,
    price: c.price ?? 0,
    change24h: c.change_24h ?? 0,
    marketCap: c.market_cap ?? 0,
    volume24h: c.volume ?? 0,
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
    .slice(0, 8);

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
  if (!signals.length) signals = fallbackSignals();

  let newsRaw: NewsArticleSummary[] = newsRes.status === "fulfilled" ? newsRes.value : [];
  let news: NewsIntelRow[] = newsRaw.map((item) => ({
    id: item.id,
    title: item.title,
    source: item.source,
    url: item.url,
    aiSummary: aiSummaryForNews(item),
    narrativeImpact: narrativeImpactFromNews(item),
    publishedAt: item.published_at ?? null,
  }));
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

  const heroMcap = globalMcap ?? (vk.length ? vk.reduce((s, c) => s + (c.market_cap ?? 0), 0) : 2.45e12);
  const heroVol = globalVol ?? (vk.length ? vk.reduce((s, c) => s + (c.volume ?? 0), 0) : 98e9);
  const heroBtc = btcDom ?? 52.4;
  const heroEth = ethDom ?? 17.2;

  return {
    meta: {
      generatedAt,
      cacheTtlSec: HOME_DASHBOARD_CACHE_SEC,
      marketSource,
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
      heatmap: heatmapCoins.length
        ? heatmapCoins
        : [...DEMO_GAINERS_LOSERS.gainers, ...DEMO_GAINERS_LOSERS.losers].map((r) => ({
            symbol: r.symbol,
            name: r.name,
            slug: r.slug,
            logoUrl: r.logoUrl,
            price: r.price,
            change24h: r.change24h,
            marketCap: r.marketCap,
            volume24h: r.volume24h,
          })),
      volumeSpikes: volumeSpikes.length
        ? volumeSpikes
        : [
            {
              symbol: "SOL",
              name: "Solana",
              slug: "solana",
              logoUrl: null,
              volume24h: 3.2e9,
              marketCap: 9.5e10,
              volToMcap: 0.034,
              change24h: 1.8,
            },
            {
              symbol: "ETH",
              name: "Ethereum",
              slug: "ethereum",
              logoUrl: null,
              volume24h: 1.8e10,
              marketCap: 4.2e11,
              volToMcap: 0.043,
              change24h: 0.9,
            },
          ],
    },
    narratives: narrativesFull.length ? narrativesFull : fallbackCategories().map(categoryToNarrativeRow),
    smartMoney: { wallets, flows },
    signals: signals.slice(0, 8),
    news: news.slice(0, 8),
    opportunities,
  };
}
