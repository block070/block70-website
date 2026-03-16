import Link from "next/link";
import type { WalletLeaderboardEntry } from "@/lib/types";

type WhaleFeedProps = {
  wallets: WalletLeaderboardEntry[];
  maxItems?: number;
};

function formatUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function WhaleFeed({ wallets, maxItems = 8 }: WhaleFeedProps) {
  const list = wallets.slice(0, maxItems);

  if (list.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        No whale activity yet. Large trades from the wallet tracker will appear here.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {list.map((w, i) => (
        <li
          key={w.wallet_address}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-slate-500 shrink-0">#{i + 1}</span>
            <span className="font-mono text-slate-300 truncate max-w-[120px] md:max-w-[180px]">
              {w.wallet_address.slice(0, 6)}…{w.wallet_address.slice(-4)}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-emerald-400">
              Win rate {(w.win_rate * 100).toFixed(0)}%
            </span>
            <span className="text-slate-400">
              Profit {formatUsd(w.total_profit_usd)}
            </span>
            <span className="text-slate-500">
              ROI {(w.average_roi * 100).toFixed(0)}%
            </span>
          </div>
          <Link
            href="/wallets"
            className="shrink-0 text-[11px] font-medium text-blue-400 hover:text-blue-300"
          >
            View
          </Link>
        </li>
      ))}
    </ul>
  );
}
