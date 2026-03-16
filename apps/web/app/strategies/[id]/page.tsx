"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getPublicStrategyById,
  getPublicStrategy,
  type TradingStrategyDto,
} from "@/lib/trading-strategies-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShareButtons } from "@/components/social/share-buttons";

export default function PublicStrategyPage() {
  const params = useParams();
  const rawId = params?.id;
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  const [strategy, setStrategy] = useState<TradingStrategyDto | null>(null);
  const [backtest, setBacktest] = useState<{
    total_trades: number;
    win_rate: number;
    average_profit: number;
    max_drawdown: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Number.isNaN(id)) {
      setError("Invalid strategy ID");
      setLoading(false);
      return;
    }
    Promise.all([
      getPublicStrategyById(id),
      getPublicStrategy(id).then((r) => r.backtest).catch(() => null),
    ])
      .then(([s, bt]) => {
        setStrategy(s);
        setBacktest(bt);
      })
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

  if (error || !strategy) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-50">Strategy</h1>
        <p className="text-rose-400">{error || "Not found"}</p>
        <Link href="/strategies/top">
          <Button>Browse top strategies</Button>
        </Link>
      </div>
    );
  }

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/strategies/${id}`
      : "";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/strategies/top">
            <Button variant="outline">← Back</Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-50">
            {strategy.strategy_name}
          </h1>
        </div>
        {shareUrl && (
          <ShareButtons
            url={shareUrl}
            title={`Strategy: ${strategy.strategy_name} | Block70`}
            variant="default"
          />
        )}
      </div>

      {strategy.description && (
        <Card>
          <CardHeader title="Description" />
          <div className="p-4 pt-0 text-slate-300">{strategy.description}</div>
        </Card>
      )}

      {(strategy.entry_rules || strategy.exit_rules) && (
        <Card>
          <CardHeader title="Rules" />
          <div className="space-y-4 p-4 pt-0 text-sm text-slate-300">
            {strategy.entry_rules && (
              <div>
                <p className="font-medium text-slate-400">Entry</p>
                <p className="whitespace-pre-wrap">{strategy.entry_rules}</p>
              </div>
            )}
            {strategy.exit_rules && (
              <div>
                <p className="font-medium text-slate-400">Exit</p>
                <p className="whitespace-pre-wrap">{strategy.exit_rules}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Performance"
          subtitle="Latest backtest results"
        />
        <div className="p-4">
          {backtest ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Win rate</p>
                <p className="text-xl font-semibold text-slate-100">
                  {(backtest.win_rate * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total trades</p>
                <p className="text-xl font-semibold text-slate-100">
                  {backtest.total_trades}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Average profit</p>
                <p className="text-xl font-semibold text-emerald-400">
                  {backtest.average_profit >= 0 ? "+" : ""}
                  {backtest.average_profit.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Max drawdown</p>
                <p className="text-xl font-semibold text-rose-400">
                  {backtest.max_drawdown.toFixed(2)}%
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
