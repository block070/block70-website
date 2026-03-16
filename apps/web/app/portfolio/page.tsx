"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getPortfolio,
  getPortfolioTokens,
  getPortfolioTransactions,
  getPortfolioMetrics,
  type PortfolioDto,
  type PortfolioTokenBalanceDto,
  type PortfolioTransactionDto,
  type PortfolioMetricsDto,
} from "@/lib/portfolio-api";
import { PerformanceCards } from "@/components/portfolio/performance-cards";
import { ValueChart } from "@/components/portfolio/value-chart";
import { TokenHoldingsTable } from "@/components/portfolio/token-holdings-table";
import { AddWallet } from "@/components/portfolio/add-wallet";
import { InsightsPanel } from "@/components/portfolio/insights-panel";
import { PortfolioHeatmap } from "@/components/portfolio/portfolio-heatmap";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { syncPortfolio } from "@/lib/portfolio-api";

function formatUsd(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${value.toFixed(2)}`;
}

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<PortfolioDto | null>(null);
  const [tokens, setTokens] = useState<PortfolioTokenBalanceDto[]>([]);
  const [transactions, setTransactions] = useState<PortfolioTransactionDto[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetricsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, t, tx, m] = await Promise.all([
        getPortfolio(),
        getPortfolioTokens(),
        getPortfolioTransactions(30),
        getPortfolioMetrics(),
      ]);
      setPortfolio(p);
      setTokens(t);
      setTransactions(tx);
      setMetrics(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncPortfolio();
      await load();
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-50">Portfolio</h1>
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">
          {error}. Log in to view your portfolio.
        </div>
        <Link href="/login">
          <Button>Log in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-50">Portfolio</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="text-sm"
            onClick={handleSync}
            disabled={syncing || loading}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync"}
          </Button>
          <Link href="/portfolio/history">
            <Button variant="outline" className="text-sm">
              History
            </Button>
          </Link>
        </div>
      </div>

      <section>
        <PerformanceCards metrics={metrics} loading={loading} />
      </section>

      <section>
        <ValueChart portfolio={portfolio} loading={loading} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <TokenHoldingsTable tokens={tokens} loading={loading} />
        <AddWallet />
      </section>

      <section>
        <PortfolioHeatmap tokens={tokens} loading={loading} />
      </section>

      <section>
        <Card>
          <CardHeader
            title="Recent transactions"
            subtitle="Latest activity across tracked wallets"
          />
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-4">
                <div className="h-24 animate-pulse rounded bg-[var(--b70-border)]" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">
                No transactions yet. Add a wallet and sync.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--b70-border)] text-left text-slate-500">
                    <th className="px-4 py-2 font-medium">Token</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium text-right">Amount</th>
                    <th className="px-4 py-2 font-medium text-right">Value</th>
                    <th className="px-4 py-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 15).map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-[var(--b70-border)] last:border-0"
                    >
                      <td className="px-4 py-2 font-medium text-slate-200">
                        {tx.token_symbol}
                      </td>
                      <td className="px-4 py-2 text-slate-400">
                        {tx.transaction_type}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-300">
                        {tx.amount.toFixed(4)}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-300">
                        {formatUsd(tx.value_usd)}
                      </td>
                      <td className="px-4 py-2 text-slate-500">
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="border-t border-[var(--b70-border)] px-4 py-2">
            <Link
              href="/portfolio/history"
              className="text-xs font-medium text-[var(--b70-crypto-blue)] hover:underline"
            >
              View full history →
            </Link>
          </div>
        </Card>
      </section>

      <section>
        <InsightsPanel />
      </section>
    </div>
  );
}
