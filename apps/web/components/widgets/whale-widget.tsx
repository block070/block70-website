"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { getWalletLeaderboard } from "@/lib/api";
import type { WalletLeaderboardEntry } from "@/lib/types";
import type { WidgetSettings } from "@/components/dashboard/widget-loader";

function formatUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function WhaleWidget({
  widgetId,
  settings,
}: {
  widgetId: string;
  settings?: WidgetSettings;
}) {
  const [wallets, setWallets] = useState<WalletLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getWalletLeaderboard()
      .then((data) => {
        if (!cancelled) setWallets(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="Whale activity"
        subtitle="Recent large trades"
        action={
          <Link
            href="/wallets/smart-money"
            className="text-xs font-medium text-[var(--b70-crypto-blue)] hover:underline"
          >
            Smart money →
          </Link>
        }
      />
      <div className="flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : wallets.length === 0 ? (
          <p className="text-xs text-slate-500">No whale activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {wallets.slice(0, settings?.limit ?? 6).map((w) => (
              <li
                key={w.wallet_address}
                className="flex items-center justify-between rounded border border-[var(--b70-border)] px-2 py-1.5 text-xs"
              >
                <span className="font-mono text-slate-300 truncate max-w-[100px]">
                  {w.wallet_address.slice(0, 6)}…{w.wallet_address.slice(-4)}
                </span>
                <span className="text-emerald-400">
                  {(w.win_rate * 100).toFixed(0)}% win
                </span>
                <span className="text-slate-400">{formatUsd(w.total_profit_usd)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
