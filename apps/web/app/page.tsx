import Link from "next/link";
import dynamic from "next/dynamic";
import {
  getOpportunities,
  getSignalsLatest,
  getWalletLeaderboard,
  getSignalsTrending,
  getAirdrops,
} from "@/lib/api";
import { HeroMarketOverview } from "@/components/home/hero-market-overview";
import { MarketStatsBar } from "@/components/home/market-stats-bar";
import { GainersLosers } from "@/components/market/gainers-losers";
import { MarketHeatmap } from "@/components/market/market-heatmap";
import { QuickNav } from "@/components/home/quick-nav";
import { NarrativesSection } from "@/components/home/narratives-section";
import { NewsSection } from "@/components/home/news-section";
import { UserDashboard } from "@/components/home/user-dashboard";

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
  try {
    const [opps, sigs, wallets, trend, air] = await Promise.all([
      getOpportunities(),
      getSignalsLatest({ limit: 10 }),
      getWalletLeaderboard(),
      getSignalsTrending({ hours: 24, limit: 12 }),
      getAirdrops(),
    ]);
    opportunities = opps.sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));
    signals = sigs;
    walletLeaderboard = wallets;
    trending = trend;
    airdrops = air;
  } catch {
    // use empty arrays
  }

  return (
    <div className="space-y-6">
      {/* Hero + Market stats */}
      <section className="grid gap-4 lg:grid-cols-1">
        <HeroMarketOverview topTrendingCoin={{ symbol: "SOL", change24h: 8.2 }} />
        <MarketStatsBar />
      </section>

      {/* Quick nav */}
      <QuickNav />

      {/* Gainers / Losers + Heatmap */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-50">
          Top gainers & losers
        </h2>
        <GainersLosers />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-50">
          Market heatmap
        </h2>
        <MarketHeatmap />
      </section>

      {/* Trending coins */}
      <section>
        <TrendingCoins trending={trending} />
      </section>

      {/* Two-column: Signals + Opportunities */}
      <section className="grid gap-4 lg:grid-cols-2">
        <SignalsFeed signals={signals} />
        <TopOpportunities opportunities={opportunities} />
      </section>

      {/* Whale + Airdrop + User dashboard */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <WhaleActivity wallets={walletLeaderboard} />
        <AirdropHighlights airdrops={airdrops} />
        <UserDashboard />
      </section>

      {/* Narratives + News */}
      <section className="grid gap-4 lg:grid-cols-2">
        <NarrativesSection />
        <NewsSection />
      </section>
    </div>
  );
}
