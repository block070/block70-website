"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getPublicStrategy } from "@/lib/trading-strategies-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function StrategySharePage() {
  const params = useParams();
  const id = Number(params.id);
  const [data, setData] = useState<{
    strategy_id: number;
    strategy_name: string;
    description: string | null;
    backtest: {
      total_trades: number;
      win_rate: number;
      average_profit: number;
      max_drawdown: number;
      total_return_pct?: number;
    } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Number.isNaN(id)) {
      setError("Invalid strategy ID");
      setLoading(false);
      return;
    }
    getPublicStrategy(id)
      .then(setData)
      .catch(() => setError("Strategy not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-50">Strategy</h1>
        <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-50">Strategy</h1>
        <p className="text-rose-400">{error || "Not found"}</p>
        <Link href="/strategies">
          <Button>Back to strategies</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/strategies">
          <Button variant="outline">← Back</Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-50">Shared strategy</h1>
      </div>

      <Card>
        <CardHeader
          title={data.strategy_name}
          subtitle={data.description || "No description"}
        />
        <div className="p-4">
          {data.backtest ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-slate-500">Win rate</p>
                <p className="text-xl font-semibold text-slate-100">
                  {(data.backtest.win_rate * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total trades</p>
                <p className="text-xl font-semibold text-slate-100">
                  {data.backtest.total_trades}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total return</p>
                <p
                  className={`text-xl font-semibold ${
                    (data.backtest.total_return_pct ?? 0) >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {(data.backtest.total_return_pct ?? 0) >= 0 ? "+" : ""}
                  {(data.backtest.total_return_pct ?? 0).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Average profit</p>
                <p className="text-xl font-semibold text-emerald-400">
                  {data.backtest.average_profit >= 0 ? "+" : ""}
                  {data.backtest.average_profit.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Max drawdown</p>
                <p className="text-xl font-semibold text-rose-400">
                  {data.backtest.max_drawdown.toFixed(2)}%
                </p>
              </div>
            </div>
          ) : (
            <p className="text-slate-500">No backtest results yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
