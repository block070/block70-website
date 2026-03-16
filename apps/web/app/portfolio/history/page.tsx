"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getPortfolio,
  getPortfolioTransactions,
  type PortfolioDto,
  type PortfolioTransactionDto,
} from "@/lib/portfolio-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function formatUsd(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${value.toFixed(2)}`;
}

export default function PortfolioHistoryPage() {
  const [portfolio, setPortfolio] = useState<PortfolioDto | null>(null);
  const [transactions, setTransactions] = useState<PortfolioTransactionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getPortfolio(), getPortfolioTransactions(200)])
      .then(([p, tx]) => {
        setPortfolio(p);
        setTransactions(tx);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-50">Portfolio history</h1>
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">
          {error}. Log in to view history.
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
        <h1 className="text-2xl font-bold text-slate-50">Portfolio history</h1>
        <Link href="/portfolio">
          <Button variant="outline">Back to portfolio</Button>
        </Link>
      </div>

      {portfolio && (
        <Card className="p-4">
          <p className="text-xs text-slate-500">Current portfolio value</p>
          <p className="text-2xl font-semibold text-slate-100">
            {formatUsd(portfolio.total_value_usd ?? 0)}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Profit / loss:{" "}
            <span
              className={
                (portfolio.total_profit_loss ?? 0) >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
              }
            >
              {(portfolio.total_profit_loss ?? 0) >= 0 ? "+" : ""}
              {formatUsd(portfolio.total_profit_loss ?? 0)}
            </span>
          </p>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Transaction timeline"
          subtitle="Historical activity across tracked wallets"
        />
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4">
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded bg-[var(--b70-border)]"
                  />
                ))}
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              No transactions yet. Add a wallet and sync on the main portfolio
              page.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--b70-border)] text-left text-slate-500">
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Token</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium text-right">Amount</th>
                  <th className="px-4 py-2 font-medium text-right">Value</th>
                  <th className="px-4 py-2 font-medium">Tx hash</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-[var(--b70-border)] last:border-0"
                  >
                    <td className="px-4 py-2 text-slate-400">
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
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
                    <td className="px-4 py-2 font-mono text-xs text-slate-500 truncate max-w-[120px]">
                      {tx.tx_hash}
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
