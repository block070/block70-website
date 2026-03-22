import Link from "next/link";
import { CoinSymbol } from "@/components/market/coin-symbol";
import type { TrendingSignalTokenDto } from "@/lib/types";

type TrendingCoinsProps = {
  trending: TrendingSignalTokenDto[];
  errorMessage?: string | null;
};

export function TrendingCoins({ trending, errorMessage = null }: TrendingCoinsProps) {
  return (
    <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--b70-text)]">Trending coins</h3>
          <p className="mt-0.5 text-[11px] text-[var(--b70-text-muted)]">
            By volume, signals & social activity
          </p>
        </div>
        <Link
          href="/signals/trending"
          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View all
        </Link>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {errorMessage ? (
          <p className="col-span-full text-xs text-[var(--b70-text-muted)]">
            Data temporarily unavailable.{" "}
            <span className="font-mono">{errorMessage}</span>
          </p>
        ) : trending.length === 0 ? (
          <p className="col-span-full text-xs text-[var(--b70-text-muted)]">
            No trending data yet.
          </p>
        ) : (
          trending.slice(0, 6).map((t, i) => (
            <Link
              key={`${t.token_symbol}-${i}`}
              href={`/signals/${encodeURIComponent(t.token_symbol || t.token_address || "-")}`}
              className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3 text-sm transition-colors hover:bg-slate-200/80 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
            >
              <div className="flex items-center justify-between">
                <CoinSymbol
                  symbol={t.token_symbol || t.token_address || "—"}
                  size="sm"
                />
                <span className="text-[10px] text-[var(--b70-text-muted)]">
                  {t.signal_count} signals
                </span>
              </div>
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                {(t.avg_confidence_score * 100).toFixed(0)}% confidence
              </p>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
