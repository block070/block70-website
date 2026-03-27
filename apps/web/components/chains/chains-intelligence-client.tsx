"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getChains, type ChainDto } from "@/lib/api";
import { ChainsStatCards } from "@/components/chains/chains-stat-cards";
import { ChainsCapitalFlowRails } from "@/components/chains/chains-capital-flow-rails";
import { ChainsFastGrowingStrip } from "@/components/chains/chains-fast-growing-strip";
import { ChainsHighlightCards } from "@/components/chains/chains-highlight-cards";
import { ChainsCompareBar } from "@/components/chains/chains-compare-bar";
import { ChainsTable, type SortKey } from "@/components/chains/chains-table";
import { ChainsFilters } from "@/components/chains/chains-filters";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, RefreshCw } from "lucide-react";

const MAX_COMPARE = 4;

function normalizeChain(row: ChainDto): ChainDto {
  return {
    ...row,
    tvl_change_is_estimated: row.tvl_change_is_estimated ?? false,
    volume_24h: row.volume_24h ?? null,
    fees_24h: row.fees_24h ?? null,
    active_addresses_24h: row.active_addresses_24h ?? null,
  };
}

function parseCompareParam(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, MAX_COMPARE);
}

export function ChainsIntelligenceClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sortBy, setSortBy] = useState<SortKey>("netflow");

  const compareSlugs = useMemo(
    () => parseCompareParam(searchParams.get("compare")),
    [searchParams],
  );

  const { data: rawChains, error, isLoading, mutate } = useSWR<ChainDto[]>(
    "/api/v1/chains?limit=50",
    async () => getChains({ limit: 50 }),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const chains = useMemo(
    () => (rawChains ?? []).map(normalizeChain),
    [rawChains],
  );

  const pushCompare = useCallback(
    (next: string[]) => {
      const q = new URLSearchParams(searchParams.toString());
      if (next.length) q.set("compare", next.join(","));
      else q.delete("compare");
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const toggleCompare = useCallback(
    (slug: string) => {
      const i = compareSlugs.indexOf(slug);
      const next =
        i >= 0
          ? compareSlugs.filter((s) => s !== slug)
          : compareSlugs.length >= MAX_COMPARE
            ? [...compareSlugs.slice(1), slug]
            : [...compareSlugs, slug];
      pushCompare(next);
    },
    [compareSlugs, pushCompare],
  );

  const clearCompare = useCallback(() => {
    pushCompare([]);
  }, [pushCompare]);

  const removeCompare = useCallback(
    (slug: string) => {
      pushCompare(compareSlugs.filter((s) => s !== slug));
    },
    [compareSlugs, pushCompare],
  );

  if (error) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-crypto-blue" aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
              Ecosystem intelligence
            </h1>
          </div>
          <p className="text-sm text-[var(--b70-text-muted)]">
            Compare chains by TVL, modeled flows, and protocol mix (DeFiLlama-backed).
          </p>
        </header>
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-center">
          <p className="text-rose-400">Failed to load chains data.</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-4 py-2 text-sm text-[var(--b70-text)] hover:bg-[var(--b70-bg)]"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <BarChart3 className="h-7 w-7 text-crypto-blue" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
            Ecosystem intelligence
          </h1>
        </div>
        <p className="max-w-3xl text-sm text-[var(--b70-text-muted)]">
          Real-time style snapshot of chain TVL from DeFiLlama, with modeled 24h liquidity rotation,
          protocol category mix, and optional token leaders. Volume, fees, and DAA columns fill as
          connectors land — not invented in the UI.
        </p>
      </header>

      {isLoading ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </>
      ) : chains.length > 0 ? (
        <>
          <ChainsCompareBar
            chains={chains}
            compareSlugs={compareSlugs}
            onRemove={removeCompare}
            onClear={clearCompare}
          />

          <ChainsCapitalFlowRails chains={chains} />

          <ChainsFastGrowingStrip chains={chains} />

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--b70-text)]">Largest ecosystems</h2>
            <ChainsHighlightCards chains={chains} compareSlugs={compareSlugs} max={6} />
          </section>

          <ChainsStatCards chains={chains} />

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--b70-text)]">Leaderboard</h2>
            <p className="text-xs text-[var(--b70-text-muted)]">
              Use compare checkboxes (up to {MAX_COMPARE}) to pin chains to the bar above. URLs support{" "}
              <code className="rounded bg-[var(--b70-bg)] px-1 py-0.5 font-mono text-[10px]">
                ?compare=ethereum,solana,base
              </code>
              .
            </p>
            <ChainsFilters active={sortBy} onChange={setSortBy} />
            <ChainsTable
              chains={chains}
              sortBy={sortBy}
              onSortChange={setSortBy}
              compareSlugs={compareSlugs}
              onCompareToggle={toggleCompare}
              maxCompare={MAX_COMPARE}
            />
          </section>
        </>
      ) : (
        <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-8 text-center text-[var(--b70-text-muted)]">
          No chain data available.
        </div>
      )}
    </div>
  );
}
