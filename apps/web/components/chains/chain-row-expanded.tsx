"use client";

import Link from "next/link";
import useSWR from "swr";
import { useMemo } from "react";
import {
  getChainExpansion,
  type ChainExpansionDto,
} from "@/lib/api";
import { formatChangePct, formatCompactUsd } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { chainsCompareSlug } from "@/lib/chains-compare-slug";
import { PieChart } from "lucide-react";

type Props = { chainName: string };

const expansionFetcher = (key: string) => {
  const [name, limit] = JSON.parse(key) as [string, number];
  return getChainExpansion(name, limit);
};

export function ChainRowExpanded({ chainName }: Props) {
  const { data, isLoading } = useSWR<ChainExpansionDto>(
    JSON.stringify([chainName, 8]),
    expansionFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const protocols = (data?.protocols ?? []).slice(0, 8);
  const coins = (data?.coins ?? []).slice(0, 8);
  const chainSlug = chainsCompareSlug(chainName);
  const trendingUrl = `/trending${chainSlug ? `?chain=${encodeURIComponent(chainSlug)}` : ""}`;
  const opportunitiesUrl = `/opportunities${chainSlug ? `?chain=${encodeURIComponent(chainSlug)}` : ""}`;

  const categoryShares = useMemo(() => {
    const by = new Map<string, number>();
    let total = 0;
    for (const p of protocols) {
      const cat = (p.category || "Other").trim() || "Other";
      const t = Math.max(0, p.tvl || 0);
      by.set(cat, (by.get(cat) || 0) + t);
      total += t;
    }
    return [...by.entries()]
      .map(([category, tvl]) => ({
        category,
        tvl,
        sharePct: total > 0 ? (tvl / total) * 100 : 0,
      }))
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, 8);
  }, [protocols]);

  if (isLoading) {
    return (
      <div className="border-t border-[var(--b70-border)] bg-[var(--b70-bg)]/40 px-4 py-4">
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--b70-border)] bg-[var(--b70-bg)]/40 px-4 py-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
            <PieChart className="h-3.5 w-3.5" aria-hidden />
            Top categories (by protocol TVL)
          </p>
          {categoryShares.length === 0 ? (
            <p className="text-xs text-[var(--b70-text-muted)]">
              No protocol mix on this chain in the DeFiLlama snapshot.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {categoryShares.map((row) => (
                <li
                  key={row.category}
                  className="rounded-full border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-1 text-[11px]"
                >
                  <span className="font-medium text-[var(--b70-text)]">{row.category}</span>
                  <span className="ml-1.5 tabular-nums text-[var(--b70-text-muted)]">
                    {row.sharePct.toFixed(0)}% · {formatCompactUsd(row.tvl)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
            Top tokens (volume / DB)
          </p>
          {coins.length === 0 ? (
            <p className="text-xs text-[var(--b70-text-muted)]">No token list for this chain yet.</p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {coins.map((c) => (
                  <li key={`${c.slug}-${c.symbol}`} className="flex items-center justify-between text-xs">
                    {c.slug ? (
                      <Link
                        href={`/coins/${encodeURIComponent(c.slug)}`}
                        className="font-medium text-crypto-blue hover:underline"
                      >
                        {c.name}{" "}
                        <span className="text-[var(--b70-text-muted)]">({c.symbol})</span>
                      </Link>
                    ) : (
                      <span className="font-medium text-[var(--b70-text)]">
                        {c.name}{" "}
                        <span className="text-[var(--b70-text-muted)]">({c.symbol})</span>
                      </span>
                    )}
                    <span className="flex shrink-0 items-center gap-2 tabular-nums">
                      <span className="text-[var(--b70-text-muted)]">{formatCompactUsd(c.price)}</span>
                      {c.change_24h != null && Number.isFinite(c.change_24h) && (
                        <span className={c.change_24h >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {formatChangePct(c.change_24h)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-[var(--b70-text-muted)]">
                Prefer on-chain context: rankings use DB volume by chain when the server has coverage;
                otherwise a short global market list may appear.
              </p>
            </>
          )}
        </div>
      </div>

      {protocols.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
            Top protocols
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {protocols.slice(0, 4).map((p) => (
              <div
                key={`${p.name}-${p.tvl}`}
                className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2"
              >
                <span className="text-sm font-medium text-[var(--b70-text)]">{p.name}</span>
                <span className="mx-1.5 text-[var(--b70-text-muted)]">·</span>
                <span className="text-[11px] text-[var(--b70-text-muted)]">{p.category}</span>
                <span className="block text-xs font-medium text-emerald-400">
                  {formatCompactUsd(p.tvl)} TVL
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--b70-border)] pt-4">
        <Link
          href={trendingUrl}
          className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-xs font-medium text-[var(--b70-text)] transition hover:border-crypto-blue/40"
        >
          Trending on chain
        </Link>
        <Link
          href={opportunitiesUrl}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20"
        >
          Opportunities
        </Link>
      </div>
    </div>
  );
}
