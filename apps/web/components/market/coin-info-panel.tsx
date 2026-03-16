import type { Coin } from "@/lib/crypto-mock";

type Props = {
  coin: Coin;
};

export function CoinInfoPanel({ coin }: Props) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          Overview
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <h1 className="text-xl font-semibold text-slate-50">
            {coin.name}
          </h1>
          <span className="text-[11px] text-slate-400">{coin.symbol}</span>
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
            Rank #{coin.rank}
          </span>
        </div>
        <p className="mt-3 text-2xl font-semibold text-slate-50">
          ${coin.priceUsd.toLocaleString()}
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          24h:{" "}
          <span
            className={
              coin.change24hPct >= 0 ? "text-emerald-400" : "text-red-400"
            }
          >
            {coin.change24hPct.toFixed(2)}%
          </span>{" "}
          · 7d:{" "}
          <span
            className={
              coin.change7dPct >= 0 ? "text-emerald-400" : "text-red-400"
            }
          >
            {coin.change7dPct.toFixed(2)}%
          </span>
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <InfoStat
          label="Market cap"
          value={`$${Math.round(
            coin.marketCapUsd / 1_000_000_000,
          ).toLocaleString()}B`}
        />
        <InfoStat
          label="24h volume"
          value={`$${Math.round(
            coin.volume24hUsd / 1_000_000_000,
          ).toLocaleString()}B`}
        />
        <InfoStat
          label="Category tags"
          value={
            coin.categoryIds.length
              ? coin.categoryIds.join(", ")
              : "Uncategorized"
          }
        />
      </div>
    </section>
  );
}

type InfoStatProps = {
  label: string;
  value: string;
};

function InfoStat({ label, value }: InfoStatProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

