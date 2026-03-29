"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStrategyLeaderboard } from "@/lib/trading-strategies-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type LeaderboardEntry = {
  rank: number;
  strategy_id: number;
  strategy_name: string;
  win_rate: number;
  average_profit: number;
  total_trades: number;
  max_drawdown: number;
  total_return_pct?: number;
};

export default function StrategyLeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStrategyLeaderboard(20)
      .then((r) => setEntries(r.leaderboard || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/strategies">
          <Button variant="outline">← Back</Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-50">Strategy leaderboard</h1>
      </div>

      <Card>
        <CardHeader
          title="Ranked by performance"
          subtitle="Average profit × win rate"
        />
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4">
              <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
            </div>
          ) : entries.length === 0 ? (
            <p className="p-4 text-slate-500">No strategies with backtests yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--b70-border)] text-left text-slate-500">
                  <th className="px-4 py-2 font-medium">Rank</th>
                  <th className="px-4 py-2 font-medium">Strategy</th>
                  <th className="px-4 py-2 font-medium text-right">Win rate</th>
                  <th className="px-4 py-2 font-medium text-right">Avg profit</th>
                  <th className="px-4 py-2 font-medium text-right">Trades</th>
                  <th className="px-4 py-2 font-medium text-right">Return</th>
                  <th className="px-4 py-2 font-medium text-right">Max DD</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.strategy_id}
                    className="border-b border-[var(--b70-border)] last:border-0"
                  >
                    <td className="px-4 py-2 font-medium text-slate-200">
                      #{e.rank}
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-100">
                      {e.strategy_name}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {(e.win_rate * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-right text-emerald-400">
                      {e.average_profit >= 0 ? "+" : ""}
                      {e.average_profit.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-right text-slate-400">
                      {e.total_trades}
                    </td>
                    <td
                      className={`px-4 py-2 text-right ${
                        (e.total_return_pct ?? 0) >= 0
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {(e.total_return_pct ?? 0) >= 0 ? "+" : ""}
                      {(e.total_return_pct ?? 0).toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-right text-rose-400">
                      {e.max_drawdown.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2">
                      <Link href={`/strategies/share/${e.strategy_id}`}>
                        <Button variant="ghost" className="text-xs">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
