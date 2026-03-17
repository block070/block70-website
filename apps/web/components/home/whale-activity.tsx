import Link from "next/link";
import type { WalletLeaderboardEntry } from "@/lib/types";

type WhaleActivityProps = {
  wallets: WalletLeaderboardEntry[];
};

function formatUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function WhaleActivity({ wallets }: WhaleActivityProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-50">
            Whale activity
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Large transactions from wallet tracker
          </p>
        </div>
        <Link
          href="/wallets/smart-money"
          className="text-xs font-medium text-blue-400 hover:text-blue-300"
        >
          Smart money →
        </Link>
      </div>
      <ul className="mt-3 space-y-2">
        {wallets.length === 0 ? (
          <li className="text-xs text-slate-500">
            No whale activity surfaced yet. As Block70 observes repeat winners,
            top addresses will be promoted into this view.
          </li>
        ) : (
          wallets.slice(0, 6).map((w, i) => (
            <li
              key={w.wallet_address}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
            >
              <span className="font-mono text-slate-300 truncate max-w-[100px] sm:max-w-[160px]">
                {w.wallet_address.slice(0, 6)}…{w.wallet_address.slice(-4)}
              </span>
              <span className="text-emerald-400">
                {(w.win_rate * 100).toFixed(0)}% win
              </span>
              <span className="text-slate-400">
                {formatUsd(w.total_profit_usd)}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
