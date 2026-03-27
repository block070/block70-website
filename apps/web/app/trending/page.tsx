import Link from "next/link";
import { Suspense } from "react";

import { TrendingPageClient } from "@/components/trending/trending-page-client";
import { ChainContextBanner } from "@/components/trending/chain-context-banner";
import {
  getTrendingPagePayload,
  type TrendingHoursWindow,
} from "@/lib/trending-page-data";

export const revalidate = 60;

type PageProps = {
  searchParams: Promise<{ hours?: string }>;
};

function parseHours(raw: string | undefined): TrendingHoursWindow {
  if (raw === "1" || raw === "6" || raw === "24") return Number(raw) as TrendingHoursWindow;
  return 24;
}

export const metadata = {
  title: "Trending attention · Block70",
  description:
    "Attention and momentum engine: ranked coins with signal-window overlay, narratives, sector rotation, and bubble map. Tape + Block70 signals — not search/social volume yet. Not financial advice.",
};

export default async function TrendingPage({ searchParams }: PageProps) {
  const { hours: hoursParam } = await searchParams;
  const hours = parseHours(hoursParam);
  const { rows, opportunities, updatedAt, isFallback, narratives, categories } =
    await getTrendingPagePayload(hours);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          Trending attention
        </h1>
        <p className="text-sm text-[var(--b70-text-muted)]">
          Where attention, volume, and narratives are moving—ranked by a composite Attention Score
          (tape, momentum, CoinGecko buzz, and signal heat in your chosen window). Rank changes and
          “New” badges update as you stay on the page. Not financial advice.
        </p>
      </header>

      <Suspense fallback={null}>
        <ChainContextBanner />
      </Suspense>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400">
          No trending data yet. Try again shortly.
        </div>
      ) : (
        <TrendingPageClient
          initialRows={rows}
          initialOpportunities={opportunities}
          initialUpdatedAt={updatedAt}
          initialNarratives={narratives}
          initialCategories={categories}
          initialHours={hours}
          isFallback={isFallback}
        />
      )}

      <p className="text-xs text-[var(--b70-text-muted)]">
        <Link href="/coins" className="text-crypto-blue hover:underline">
          Browse all coins
        </Link>
        {" · "}
        <Link href="/categories" className="text-crypto-blue hover:underline">
          Categories
        </Link>
      </p>
    </div>
  );
}
