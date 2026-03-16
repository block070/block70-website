"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { getTopPools } from "@/lib/api";
import type { WidgetSettings } from "@/components/dashboard/widget-loader";

function formatUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function MarketOverviewWidget({
  widgetId,
  settings,
}: {
  widgetId: string;
  settings?: WidgetSettings;
}) {
  const [pools, setPools] = useState<{
    id: number;
    pair: string;
    liquidity_usd: number;
    volume_24h: number;
    dex: string;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTopPools(settings?.limit ?? 6)
      .then((data) => {
        if (!cancelled) setPools(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings?.limit]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="Market overview"
        subtitle="Key market stats"
        action={
          <Link
            href="/liquidity"
            className="text-xs font-medium text-[var(--b70-crypto-blue)] hover:underline"
          >
            Pools
          </Link>
        }
      />
      <div className="flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : pools.length === 0 ? (
          <p className="text-xs text-slate-500">No pool data yet.</p>
        ) : (
          <ul className="space-y-2">
            {pools.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded border border-[var(--b70-border)] px-2 py-1.5 text-xs"
              >
                <span className="truncate text-slate-200">{p.pair}</span>
                <span className="text-slate-400 shrink-0">
                  Liq. {formatUsd(p.liquidity_usd)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
