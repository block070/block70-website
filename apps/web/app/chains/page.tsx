"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { getChains, type ChainDto } from "@/lib/api";
import { ChainsStatCards } from "@/components/chains/chains-stat-cards";
import { MoneyFlowSection } from "@/components/chains/money-flow-section";
import { ChainsTable, type SortKey } from "@/components/chains/chains-table";
import { ChainsFilters } from "@/components/chains/chains-filters";
import { Skeleton } from "@/components/ui/skeleton";

function ChainsPageContent() {
  const [sortBy, setSortBy] = useState<SortKey>("netflow");
  const renderStart = useRef<number>(0);

  const { data: chains, error, isLoading, mutate } = useSWR<ChainDto[]>(
    "/api/v1/chains?limit=50",
    async () => {
      const start = performance.now();
      const data = await getChains({ limit: 50 });
      console.log("[Chains] API response time:", Math.round(performance.now() - start), "ms");
      return data;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  useEffect(() => {
    if (typeof performance !== "undefined" && performance.now) {
      renderStart.current = performance.now();
    }
  }, []);

  useEffect(() => {
    if (chains && typeof performance !== "undefined") {
      const elapsed = performance.now() - renderStart.current;
      console.log("[Chains] Page render + data load:", Math.round(elapsed), "ms");
    }
  }, [chains]);

  const handleSortChange = useCallback((key: SortKey) => {
    setSortBy(key);
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Blockchain Ecosystem Intelligence
          </h1>
          <p className="text-sm text-slate-400">
            Track where capital, users, and activity are flowing across major
            blockchains in real-time.
          </p>
        </header>
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6 text-center">
          <p className="text-red-400">Failed to load chains data.</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Blockchain Ecosystem Intelligence
        </h1>
        <p className="text-sm text-slate-400">
          Track where capital, users, and activity are flowing across major
          blockchains in real-time.
        </p>
      </header>

      {isLoading ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </>
      ) : chains && chains.length > 0 ? (
        <>
          <ChainsStatCards chains={chains} />
          <MoneyFlowSection chains={chains} />

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-50">
              Chain Leaderboard
            </h2>
            <ChainsFilters active={sortBy} onChange={handleSortChange} />
            <ChainsTable
              chains={chains}
              sortBy={sortBy}
              onSortChange={handleSortChange}
            />
          </section>
        </>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400">
          No chain data available.
        </div>
      )}
    </div>
  );
}

export default function ChainsPage() {
  return <ChainsPageContent />;
}
