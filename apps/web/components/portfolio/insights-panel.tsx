"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { getSmartMoneyOverlap } from "@/lib/portfolio-api";

type OverlapItem = {
  token_symbol: string;
  wallet_address: string;
  wallet_win_rate?: number;
  wallet_profit_usd?: number;
  message?: string;
};

export function InsightsPanel() {
  const [items, setItems] = useState<OverlapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSmartMoneyOverlap()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader
        title="Portfolio insights"
        subtitle="Smart wallet activity and signals related to your tokens"
      />
      <div className="p-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-[var(--b70-border)]"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">
            No smart money overlap detected yet. Add wallets and sync to see when
            tracked wallets trade your tokens.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 10).map((item, i) => (
              <li
                key={`${item.token_symbol}-${item.wallet_address}-${i}`}
                className="rounded border border-[var(--b70-border)] px-3 py-2 text-sm"
              >
                <Link
                  href={`/signals/${encodeURIComponent(item.token_symbol)}`}
                  className="font-medium text-[var(--b70-crypto-blue)] hover:underline"
                >
                  {item.token_symbol}
                </Link>
                <span className="text-slate-500"> · </span>
                <span className="text-slate-400">
                  {item.wallet_address.slice(0, 8)}…{item.wallet_address.slice(-4)}
                </span>
                {item.wallet_win_rate != null ? (
                  <span className="ml-2 text-emerald-400">
                    {(item.wallet_win_rate * 100).toFixed(0)}% win
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/wallets/smart-money"
          className="mt-3 inline-block text-xs font-medium text-[var(--b70-crypto-blue)] hover:underline"
        >
          View smart money leaderboard →
        </Link>
      </div>
    </Card>
  );
}
