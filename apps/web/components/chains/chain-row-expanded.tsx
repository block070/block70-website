"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getChainCoins } from "@/lib/api";
import { formatPrice, formatChangePct } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

type Props = { chainName: string };

export function ChainRowExpanded({ chainName }: Props) {
  const [coins, setCoins] = useState<{ name: string; symbol: string; slug: string; price: number; change_24h: number | null }[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getChainCoins(chainName, 5)
      .then((data) => {
        if (!cancelled) setCoins(data);
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

  if (!coins || coins.length === 0) {
    return (
      <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-3 text-xs text-slate-500">
        No coin data for this chain yet.
      </div>
    );
  }

  return (
    <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-3">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">
        Top coins
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 md:grid-cols-5">
        {coins.map((c) => (
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
              <span className="text-xs text-slate-300">{formatPrice(c.price)}</span>
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
    </div>
  );
}
