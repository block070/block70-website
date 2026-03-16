"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { getWalletLeaderboard } from "@/lib/api";
import type { WalletLeaderboardEntry } from "@/lib/types";
import type { WidgetSettings } from "@/components/dashboard/widget-loader";

export function WalletActivityWidget({
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
        title="Wallet activity"
        subtitle="Smart wallet transactions"
        action={
          <Link
            href="/wallets/smart-money"
            className="text-xs font-medium text-[var(--b70-crypto-blue)] hover:underline"
          >
            Leaderboard
          </Link>
        }
      />
      <div className="flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : wallets.length === 0 ? (
          <p className="text-xs text-slate-500">No wallet activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {wallets.slice(0, settings?.limit ?? 5).map((w) => (
              <li
                key={w.wallet_address}
                className="rounded border border-[var(--b70-border)] px-2 py-1.5 text-xs"
              >
                <span className="font-mono text-slate-300">
                  {w.wallet_address.slice(0, 8)}…{w.wallet_address.slice(-6)}
                </span>
                <span className="ml-2 text-slate-500">
                  {w.recent_opportunity_count} recent
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
