"use client";

import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import type { PortfolioTokenBalanceDto } from "@/lib/portfolio-api";

function formatUsd(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${value.toFixed(2)}`;
}

function formatBalance(balance: number, symbol: string): string {
  if (balance >= 1e6) return `${(balance / 1e6).toFixed(2)}M ${symbol}`;
  if (balance >= 1e3) return `${(balance / 1e3).toFixed(2)}k ${symbol}`;
  return `${balance.toFixed(4)} ${symbol}`;
}

type TokenHoldingsTableProps = {
  tokens: PortfolioTokenBalanceDto[];
  loading?: boolean;
};

export function TokenHoldingsTable({ tokens, loading }: TokenHoldingsTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader title="Token holdings" subtitle="Balance and value" />
        <div className="p-4">
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded bg-[var(--b70-border)]"
              />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Token holdings" subtitle="Balance and value" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--b70-border)] text-left text-slate-500">
              <th className="px-4 py-2 font-medium">Token</th>
              <th className="px-4 py-2 font-medium">Chain</th>
              <th className="px-4 py-2 font-medium">Balance</th>
              <th className="px-4 py-2 font-medium text-right">Value</th>
              <th className="px-4 py-2 font-medium text-right">24h</th>
            </tr>
          </thead>
          <tbody>
            {tokens.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No tokens yet. Add a wallet and sync to see holdings.
                </td>
              </tr>
            ) : (
              tokens.map((t) => (
                <tr
                  key={`${t.token_address}-${t.chain}`}
                  className="border-b border-[var(--b70-border)] last:border-0"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/signals/${encodeURIComponent(t.token_symbol)}`}
                      className="font-medium text-[var(--b70-crypto-blue)] hover:underline"
                    >
                      {t.token_symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-400">{t.chain}</td>
                  <td className="px-4 py-2 font-mono text-slate-300">
                    {formatBalance(t.balance, t.token_symbol)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-200">
                    {formatUsd(t.value_usd)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-500">—</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
