import type { SmartAlert } from "@/data/alerts";

function shortAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function AlertCard({ alert }: { alert: SmartAlert }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <p className="text-xs font-medium text-slate-100">{alert.message}</p>
      <p className="mt-1 text-[11px] text-slate-400">
        {alert.chain.toUpperCase()} · {shortAddress(alert.walletAddress)} · {alert.token} ·{" "}
        {formatUsd(alert.notionalUsd)}
      </p>
    </article>
  );
}

