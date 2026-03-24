import Link from "next/link";
import { Suspense } from "react";

import { TrendingPageClient } from "@/components/trending/trending-page-client";
import { ChainContextBanner } from "@/components/trending/chain-context-banner";
import { getTrendingPagePayload } from "@/lib/trending-page-data";

export const revalidate = 60;

export const metadata = {
  title: "Trending · Block70 Crypto Data",
  description:
    "Scan trending cryptocurrencies with Trending Score, Block70 quick signals, smart-money bias, and momentum — filter by category and drill into full analysis.",
};

export default async function TrendingPage() {
  const { rows, opportunities, updatedAt, isFallback } = await getTrendingPagePayload();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Trending</h1>
        <p className="text-sm text-slate-400">
          Fast-scan what&apos;s moving: Trending Score blends volume vs peers, momentum, and
          CoinGecko buzz; Block70 Score powers quick signals. Rows refresh every 60 seconds.
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
          isFallback={isFallback}
        />
      )}

      <p className="text-xs text-slate-400">
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
