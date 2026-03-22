import Link from "next/link";
import dynamic from "next/dynamic";
import {
  getOpportunities,
  getSignalsLatest,
  getWalletLeaderboard,
  getSignalsTrending,
  getAirdrops,
  getMarketCoins,
} from "@/lib/api";
import { HeroMarketOverview } from "@/components/home/hero-market-overview";
import { MarketStatsBar } from "@/components/home/market-stats-bar";
import { GainersLosers } from "@/components/market/gainers-losers";
import { MarketHeatmap } from "@/components/market/market-heatmap";
import { QuickNav } from "@/components/home/quick-nav";
import { NarrativesSection } from "@/components/home/narratives-section";
import { NewsSection } from "@/components/home/news-section";
import { UserDashboard } from "@/components/home/user-dashboard";
import { getNewsArticles } from "@/lib/api";

const SignalsFeed = dynamic(
  () =>
    import("@/components/home/signals-feed").then((m) => ({ default: m.SignalsFeed })),
  { loading: () => <SignalsFeedSkeleton />, ssr: true },
);

const TopOpportunities = dynamic(
  () =>
    import("@/components/home/top-opportunities").then((m) => ({
      default: m.TopOpportunities,
    })),
  { loading: () => <OpportunitiesSkeleton />, ssr: true },
);

const TrendingCoins = dynamic(
  () =>
    import("@/components/home/trending-coins").then((m) => ({
      default: m.TrendingCoins,
    })),
  { loading: () => <TrendingSkeleton />, ssr: true },
);

const WhaleActivity = dynamic(
  () =>
    import("@/components/home/whale-activity").then((m) => ({
      default: m.WhaleActivity,
    })),
  { loading: () => <WhaleSkeleton />, ssr: true },
);

const AirdropHighlights = dynamic(
  () =>
    import("@/components/home/airdrop-highlights").then((m) => ({
      default: m.AirdropHighlights,
    })),
  { loading: () => <AirdropSkeleton />, ssr: true },
);

export const revalidate = 60;

const HOME_PAGE_FETCH_TIMEOUT_MS = 15_000;

/** Wraps a promise with a timeout so slow/hanging API calls don't block the page. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Request timeout")), ms)
  );
  return Promise.race([promise, timeout]);
}

function SignalsFeedSkeleton() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="h-5 w-32 rounded bg-slate-800" />
      <div className="mt-3 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-slate-800/60 animate-pulse" />
        ))}
      </div>
    </section>
  );
}

function OpportunitiesSkeleton() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="h-5 w-40 rounded bg-slate-800" />
      <div className="mt-3 space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-slate-800/60 animate-pulse" />
        ))}
      </div>
    </section>
  );
}

function TrendingSkeleton() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="h-5 w-36 rounded bg-slate-800" />
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-slate-800/60 animate-pulse" />
        ))}
      </div>
    </section>
  );
}

function WhaleSkeleton() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="h-5 w-28 rounded bg-slate-800" />
      <ul className="mt-3 space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <li key={i} className="h-10 rounded-lg bg-slate-800/60 animate-pulse" />
        ))}
      </ul>
    </section>
  );
}

function AirdropSkeleton() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="h-5 w-36 rounded bg-slate-800" />
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-slate-800/60 animate-pulse" />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  let opportunities: Awaited<ReturnType<typeof getOpportunities>> = [];
  let signals: Awaited<ReturnType<typeof getSignalsLatest>> = [];
  let walletLeaderboard: Awaited<ReturnType<typeof getWalletLeaderboard>> = [];
  let trending: Awaited<ReturnType<typeof getSignalsTrending>> = [];
  let airdrops: Awaited<ReturnType<typeof getAirdrops>> = [];
  let news: Awaited<ReturnType<typeof getNewsArticles>> = [];
  let marketCoins: Awaited<ReturnType<typeof getMarketCoins>> = [];

  let opportunitiesError: string | null = null;
  let signalsError: string | null = null;
  let walletsError: string | null = null;
  let trendingError: string | null = null;
  let airdropsError: string | null = null;
  let newsError: string | null = null;
  let marketError: string | null = null;

  const timeout = HOME_PAGE_FETCH_TIMEOUT_MS;

  const [
    marketResult,
    oppsResult,
    signalsResult,
    walletsResult,
    trendingResult,
    airdropsResult,
    newsResult,
  ] = await Promise.allSettled([
    withTimeout(getMarketCoins({ limit: 50, page: 1 }), timeout),
    withTimeout(getOpportunities(), timeout),
    withTimeout(getSignalsLatest({ limit: 10 }), timeout),
    withTimeout(getWalletLeaderboard(), timeout),
    withTimeout(getSignalsTrending({ hours: 24, limit: 12 }), timeout),
    withTimeout(getAirdrops(), timeout),
    withTimeout(getNewsArticles({ limit: 8 }), timeout),
  ]);

  if (marketResult.status === "fulfilled") {
    marketCoins = marketResult.value;
  } else {
    marketError = marketResult.reason instanceof Error ? marketResult.reason.message : "Unknown error";
  }

  if (oppsResult.status === "fulfilled") {
    opportunities = oppsResult.value.sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));
  } else {
    opportunitiesError =
      oppsResult.reason instanceof Error ? oppsResult.reason.message : "Unknown error";
  }

  if (signalsResult.status === "fulfilled") {
    signals = signalsResult.value;
  } else {
    signalsError = signalsResult.reason instanceof Error ? signalsResult.reason.message : "Unknown error";
  }

  if (walletsResult.status === "fulfilled") {
    walletLeaderboard = walletsResult.value;
  } else {
    walletsError =
      walletsResult.reason instanceof Error ? walletsResult.reason.message : "Unknown error";
  }

  if (trendingResult.status === "fulfilled") {
    trending = trendingResult.value;
  } else {
    trendingError =
      trendingResult.reason instanceof Error ? trendingResult.reason.message : "Unknown error";
  }

  if (airdropsResult.status === "fulfilled") {
    airdrops = airdropsResult.value;
  } else {
    airdropsError =
      airdropsResult.reason instanceof Error ? airdropsResult.reason.message : "Unknown error";
  }

  if (newsResult.status === "fulfilled") {
    news = newsResult.value;
  } else {
    newsError = newsResult.reason instanceof Error ? newsResult.reason.message : "Unknown error";
  }

  const validMarket = marketCoins.filter(
    (c) =>
      typeof c.price === "number" &&
      typeof c.market_cap === "number" &&
      typeof c.volume === "number" &&
      typeof c.change_24h === "number",
  );
  const totalMarketCap = validMarket.reduce((sum, c) => sum + (c.market_cap ?? 0), 0);
  const totalVolume24h = validMarket.reduce((sum, c) => sum + (c.volume ?? 0), 0);
  const btc = validMarket.find((c) => (c.symbol || "").toUpperCase() === "BTC");
  const eth = validMarket.find((c) => (c.symbol || "").toUpperCase() === "ETH");
  const btcDominance =
    totalMarketCap > 0 && btc?.market_cap ? (btc.market_cap / totalMarketCap) * 100 : undefined;
  const ethDominance =
    totalMarketCap > 0 && eth?.market_cap ? (eth.market_cap / totalMarketCap) * 100 : undefined;

  const pricedMajors = validMarket.slice(0, 6).map((c) => ({
    symbol: c.symbol,
    price: c.price ?? 0,
    change24h: c.change_24h ?? 0,
  }));
  const gainers = [...validMarket]
    .sort((a, b) => (b.change_24h ?? -Infinity) - (a.change_24h ?? -Infinity))
    .slice(0, 10)
    .map((c) => ({
      symbol: c.symbol,
      name: c.name,
      price: c.price ?? 0,
      change24h: c.change_24h ?? 0,
      volume24h: c.volume ?? 0,
      marketCap: c.market_cap ?? 0,
    }));
  const losers = [...validMarket]
    .sort((a, b) => (a.change_24h ?? Infinity) - (b.change_24h ?? Infinity))
    .slice(0, 10)
    .map((c) => ({
      symbol: c.symbol,
      name: c.name,
      price: c.price ?? 0,
      change24h: c.change_24h ?? 0,
      volume24h: c.volume ?? 0,
      marketCap: c.market_cap ?? 0,
    }));
  const heatmapCoins = validMarket.slice(0, 50).map((c) => ({
    symbol: c.symbol,
    name: c.name,
    slug: c.slug,
    price: c.price ?? 0,
    change24h: c.change_24h ?? 0,
    marketCap: c.market_cap ?? 0,
    volume24h: c.volume ?? 0,
  }));
  const topGainer = gainers[0]?.symbol;
  const topLoser = losers[0]?.symbol;

  return (
    <div className="space-y-6">
      {/* Hero + Market stats */}
      <section className="grid gap-4 lg:grid-cols-1">
        <HeroMarketOverview
          totalMarketCap={totalMarketCap || undefined}
          volume24h={totalVolume24h || undefined}
          btcDominance={btcDominance}
          ethDominance={ethDominance}
          topTrendingCoin={
            gainers[0]
              ? { symbol: gainers[0].symbol, change24h: Number(gainers[0].change24h.toFixed(2)) }
              : undefined
          }
        />
        <MarketStatsBar
          prices={pricedMajors}
          topGainer={topGainer}
          topLoser={topLoser}
        />
      </section>

      {/* Quick nav */}
      <QuickNav />

      {/* Gainers / Losers + Heatmap */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-50">
          Top Gainers & Losers
        </h2>
        <GainersLosers gainers={gainers} losers={losers} />
        {marketError ? (
          <p className="mt-2 text-xs text-slate-500">
            Market data temporarily unavailable.{" "}
            <span className="font-mono text-slate-400">{marketError}</span>
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-50">
          Market heatmap
        </h2>
        <MarketHeatmap coins={heatmapCoins} />
      </section>

      {/* Trending coins */}
      <section>
        <TrendingCoins trending={trending} errorMessage={trendingError} />
      </section>

      {/* Two-column: News + Opportunities */}
      <section className="grid gap-4 lg:grid-cols-2">
        <NewsSection items={news} errorMessage={newsError} />
        <TopOpportunities
          opportunities={opportunities}
          errorMessage={opportunitiesError}
        />
      </section>

      {/* Whale + Airdrop + User dashboard */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <WhaleActivity wallets={walletLeaderboard} errorMessage={walletsError} />
        <AirdropHighlights airdrops={airdrops} errorMessage={airdropsError} />
        <UserDashboard />
      </section>

      {/* Narratives + Signals */}
      <section className="grid gap-4 lg:grid-cols-2">
        <NarrativesSection />
        <SignalsFeed signals={signals} errorMessage={signalsError} />
      </section>
    </div>
  );
}
