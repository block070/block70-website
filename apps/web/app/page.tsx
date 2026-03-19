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

  try {
    marketCoins = await getMarketCoins({ limit: 50, page: 1 });
  } catch (err) {
    marketError = err instanceof Error ? err.message : "Unknown error";
    marketCoins = [];
  }
  try {
    const opps = await getOpportunities();
    opportunities = opps.sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));
  } catch (err) {
    opportunitiesError = err instanceof Error ? err.message : "Unknown error";
    opportunities = [];
  }

  try {
    signals = await getSignalsLatest({ limit: 10 });
  } catch (err) {
    signalsError = err instanceof Error ? err.message : "Unknown error";
    signals = [];
  }

  try {
    walletLeaderboard = await getWalletLeaderboard();
  } catch (err) {
    walletsError = err instanceof Error ? err.message : "Unknown error";
    walletLeaderboard = [];
  }

  try {
    trending = await getSignalsTrending({ hours: 24, limit: 12 });
  } catch (err) {
    trendingError = err instanceof Error ? err.message : "Unknown error";
    trending = [];
  }

  try {
    airdrops = await getAirdrops();
  } catch (err) {
    airdropsError = err instanceof Error ? err.message : "Unknown error";
    airdrops = [];
  }

  try {
    news = await getNewsArticles({ limit: 8 });
  } catch (err) {
    newsError = err instanceof Error ? err.message : "Unknown error";
    news = [];
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
      price: c.price ?? 0,
      change24h: c.change_24h ?? 0,
      marketCap: c.market_cap ?? 0,
    }));
  const losers = [...validMarket]
    .sort((a, b) => (a.change_24h ?? Infinity) - (b.change_24h ?? Infinity))
    .slice(0, 10)
    .map((c) => ({
      symbol: c.symbol,
      price: c.price ?? 0,
      change24h: c.change_24h ?? 0,
      marketCap: c.market_cap ?? 0,
    }));
  const heatmapTokens = validMarket.slice(0, 24).map((c) => ({
    symbol: c.symbol,
    change24h: c.change_24h ?? 0,
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
          Top gainers & losers
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
        <MarketHeatmap tokens={heatmapTokens} />
      </section>

      {/* Trending coins */}
      <section>
        <TrendingCoins trending={trending} errorMessage={trendingError} />
      </section>

      {/* Two-column: Signals + Opportunities */}
      <section className="grid gap-4 lg:grid-cols-2">
        <SignalsFeed signals={signals} errorMessage={signalsError} />
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

      {/* Narratives + News */}
      <section className="grid gap-4 lg:grid-cols-2">
        <NarrativesSection />
        <NewsSection items={news} errorMessage={newsError} />
      </section>
    </div>
  );
}
