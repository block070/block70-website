"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  getChainExpansion,
  type ChainExpansionDto,
} from "@/lib/api";
import { formatCompactUsd } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

function chainToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/mainnet/i, "").trim();
}

type Props = { chainName: string };

const expansionFetcher = (key: string) => {
  const [name, limit] = JSON.parse(key) as [string, number];
  return getChainExpansion(name, limit);
};

export function ChainRowExpanded({ chainName }: Props) {
  const { data, isLoading } = useSWR<ChainExpansionDto>(
    JSON.stringify([chainName, 3]),
    expansionFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const protocols = (data?.protocols ?? []).slice(0, 3);
  const chainSlug = chainToSlug(chainName);
  const trendingUrl = `/trending${chainSlug ? `?chain=${encodeURIComponent(chainSlug)}` : ""}`;
  const opportunitiesUrl = `/opportunities${chainSlug ? `?chain=${encodeURIComponent(chainSlug)}` : ""}`;

  if (isLoading) {
    return (
      <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-4">
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-4">
      <p className="mb-3 text-[11px] uppercase tracking-wide text-slate-400">
        Top Activity on This Chain
      </p>

      {protocols.length > 0 ? (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {protocols.map((p) => (
            <div
              key={`${p.name}-${p.tvl}`}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
            >
              <span className="text-sm font-medium text-slate-200">{p.name}</span>
              <span className="mx-1.5 text-slate-600">·</span>
              <span className="text-[11px] text-slate-500">{p.category}</span>
              <span className="block text-xs text-emerald-400">
                {formatCompactUsd(p.tvl)} TVL
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-4 text-xs text-slate-500">
          No protocol activity data for this chain yet.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href={trendingUrl}
          className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-700/60"
        >
          View Trending on this Chain
        </Link>
        <Link
          href={opportunitiesUrl}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20"
        >
          Explore Opportunities
        </Link>
      </div>
    </div>
  );
}
