"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getChainExpansion,
  type ChainExpansionDto,
} from "@/lib/api";
import { formatPrice, formatChangePct, formatCompactUsd } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

type Props = { chainName: string };

export function ChainRowExpanded({ chainName }: Props) {
  const [data, setData] = useState<ChainExpansionDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getChainExpansion(chainName, 5)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chainName]);

  if (loading) {
    return (
      <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-3">
        <div className="flex gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
      </div>
    );
  }

  const hasProtocols = data?.protocols && data.protocols.length > 0;
  const hasCoins = data?.coins && data.coins.length > 0;

  if (!hasProtocols && !hasCoins) {
    return (
      <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-3 text-xs text-slate-500">
        No protocols or coin data for this chain yet.
      </div>
    );
  }

  return (
    <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-3">
      {hasProtocols && (
        <section className="mb-4">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">
            Top protocols
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 md:grid-cols-5">
            {data!.protocols.map((p) => (
              <div
                key={`${p.name}-${p.tvl}`}
                className="flex flex-col rounded px-2 py-1.5 hover:bg-slate-800/60"
              >
                <span className="text-xs font-medium text-slate-200">
                  {p.name}
                </span>
                <span className="text-[11px] text-slate-500">{p.category}</span>
                <span className="text-[11px] text-emerald-400">
                  {formatCompactUsd(p.tvl)} TVL
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      {hasCoins && (
        <section>
          <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">
            Top coins
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 md:grid-cols-5">
            {data!.coins.map((c) => (
              <Link
                key={c.slug}
                href={`/coins/${c.slug}`}
                className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-slate-800/60"
              >
                <span className="text-xs font-medium text-slate-200">
                  {c.name}
                  <span className="ml-1 text-slate-500">{c.symbol}</span>
                </span>
                <span className="text-right">
                  <span className="text-xs text-slate-300">
                    {formatPrice(c.price)}
                  </span>
                  <span
                    className={`ml-1.5 text-[11px] ${
                      c.change_24h != null && c.change_24h >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {formatChangePct(c.change_24h ?? 0)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
