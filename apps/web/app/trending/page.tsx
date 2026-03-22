import { Suspense } from "react";
import { TrendingPageClient } from "./trending-page-client";

export const metadata = {
  title: "Trending · Block70 Crypto Data",
  description: "Live trending coins from CoinGecko, proxied via Block70.",
};

export default function TrendingPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Trending</h1>
            <p className="text-sm text-slate-400">Loading trending coins…</p>
          </header>
          <div className="h-40 rounded-xl border border-slate-800 bg-slate-950/60 animate-pulse" />
        </div>
      }
    >
      <TrendingPageClient />
    </Suspense>
  );
}
