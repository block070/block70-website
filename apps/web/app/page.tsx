import { Suspense } from "react";
import Link from "next/link";
import { QuickNav } from "@/components/home/quick-nav";
import { MarketSection } from "./home-sections/market-section";
import { TrendingSection } from "./home-sections/trending-section";
import { NewsOpportunitiesSection } from "./home-sections/news-opportunities-section";
import { WhaleAirdropSection } from "./home-sections/whale-airdrop-section";
import { SignalsSection } from "./home-sections/signals-section";

export const revalidate = 60;

function MarketSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-48 rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
      <div className="h-16 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
      <div className="h-40 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
      <div className="h-64 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
    </div>
  );
}

function TrendingSkeleton() {
  return (
    <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
      <div className="h-5 w-36 rounded bg-[var(--b70-border)]" />
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-[var(--b70-border)]/60 animate-pulse" />
        ))}
      </div>
    </section>
  );
}

function NewsOppsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="h-[460px] rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
      <div className="h-[460px] rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
    </div>
  );
}

function WhaleAirdropSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-48 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
      ))}
    </div>
  );
}

function SignalsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="h-40 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
      <div className="h-40 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<MarketSkeleton />}>
        <MarketSection />
      </Suspense>

      <QuickNav />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--b70-text)]">
          Trending coins
        </h2>
        <Suspense fallback={<TrendingSkeleton />}>
          <TrendingSection />
        </Suspense>
      </section>

      <Suspense fallback={<NewsOppsSkeleton />}>
        <NewsOpportunitiesSection />
      </Suspense>

      <Suspense fallback={<WhaleAirdropSkeleton />}>
        <WhaleAirdropSection />
      </Suspense>

      <Suspense fallback={<SignalsSkeleton />}>
        <SignalsSection />
      </Suspense>
    </div>
  );
}
