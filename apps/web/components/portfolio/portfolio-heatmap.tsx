"use client";

import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import type { PortfolioTokenBalanceDto } from "@/lib/portfolio-api";

function formatUsd(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

/**
 * Visualize token performance using color intensity (value share = heat).
 */
type PortfolioHeatmapProps = {
  tokens: PortfolioTokenBalanceDto[];
  loading?: boolean;
};

export function PortfolioHeatmap({ tokens, loading }: PortfolioHeatmapProps) {
  const total = tokens.reduce((s, t) => s + (t.value_usd ?? 0), 0);
  const maxVal = Math.max(...tokens.map((t) => t.value_usd ?? 0), 1);

  if (loading) {
    return (
      <Card>
        <CardHeader title="Portfolio heatmap" subtitle="Token value share" />
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-12 w-24 animate-pulse rounded bg-[var(--b70-border)]"
              />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (tokens.length === 0) {
    return (
      <Card>
        <CardHeader title="Portfolio heatmap" subtitle="Token value share" />
        <p className="p-4 text-sm text-slate-500">
          Add wallets and sync to see token allocation.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Portfolio heatmap" subtitle="Token value share" />
      <div className="p-4">
        <div className="flex flex-wrap gap-2">
          {tokens.map((t) => {
            const share = total > 0 ? (t.value_usd ?? 0) / total : 0;
            const intensity = maxVal > 0 ? (t.value_usd ?? 0) / maxVal : 0;
            const opacity = 0.3 + intensity * 0.7;
            return (
              <Link
                key={`${t.token_address}-${t.chain}`}
                href={`/signals/${encodeURIComponent(t.token_symbol)}`}
                className="rounded-lg border border-[var(--b70-border)] px-3 py-2 text-sm transition hover:border-[var(--b70-crypto-blue)]/50"
                style={{
                  backgroundColor: `rgba(59, 130, 246, ${opacity * 0.2})`,
                  borderColor: `rgba(59, 130, 246, ${opacity * 0.5})`,
                }}
              >
                <span className="font-medium text-slate-100">{t.token_symbol}</span>
                <span className="ml-2 text-slate-400">
                  {formatUsd(t.value_usd)} ({(share * 100).toFixed(0)}%)
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
