import type { Coin } from "@/lib/crypto-mock";

type Props = {
  coin: Coin;
};

export function CoinStats({ coin }: Props) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">
        Market data
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <Stat
          label="Market cap"
          value={`$${Math.round(
            coin.marketCapUsd / 1_000_000_000,
          ).toLocaleString()}B`}
        />
        <Stat
          label="24h volume"
          value={`$${Math.round(
            coin.volume24hUsd / 1_000_000_000,
          ).toLocaleString()}B`}
        />
        <Stat
          label="Price performance"
          value={`24h ${coin.change24hPct.toFixed(
            2,
          )}% · 7d ${coin.change7dPct.toFixed(2)}%`}
        />
      </div>
    </section>
  );
}

type StatProps = {
  label: string;
  value: string;
};

function Stat({ label, value }: StatProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

