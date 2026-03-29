import Link from "next/link";
import type { WalletLeaderboardEntry } from "@/lib/types";

type WhaleActivityProps = {
  wallets: WalletLeaderboardEntry[];
  errorMessage?: string | null;
};

function formatUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function WhaleActivity({ wallets, errorMessage = null }: WhaleActivityProps) {
  return (
    <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--b70-text)]">
            Whale activity
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--b70-text-muted)]">
            Large transactions from wallet tracker
          </p>
        </div>
        <Link
          href="/smartwallets"
          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Smart money →
        </Link>
      </div>
      <ul className="mt-3 space-y-2">
        {errorMessage ? (
          <li className="text-xs text-[var(--b70-text-muted)]">
            Data temporarily unavailable.{" "}
            <span className="font-mono">{errorMessage}</span>
          </li>
        ) : wallets.length === 0 ? (
          <li className="text-xs text-[var(--b70-text-muted)]">
            No whale activity surfaced yet. As Block70 observes repeat winners,
            top addresses will be promoted into this view.
          </li>
        ) : (
          wallets.slice(0, 6).map((w, i) => (
            <li
              key={w.wallet_address}
              className="flex items-center justify-between rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/50"
            >
              <span className="font-mono text-[var(--b70-text)] truncate max-w-[100px] sm:max-w-[160px]">
                {w.wallet_address.slice(0, 6)}…{w.wallet_address.slice(-4)}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {(w.win_rate * 100).toFixed(0)}% win
              </span>
              <span className="text-[var(--b70-text-muted)]">
                {formatUsd(w.total_profit_usd)}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
