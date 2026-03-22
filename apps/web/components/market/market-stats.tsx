import { COINS, CHAINS } from "@/lib/crypto-mock";

export function MarketStats() {
  const totalMarketCap = COINS.reduce(
    (sum, c) => sum + c.marketCapUsd,
    0,
  );
  const totalVolume = COINS.reduce(
    (sum, c) => sum + c.volume24hUsd,
    0,
  );
  const dominantChain = CHAINS[0];

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <StatCard
        label="Total market cap"
        value={`$${Math.round(totalMarketCap / 1_000_000_000).toLocaleString()}B`}
        helper="Aggregated across tracked majors"
      />
      <StatCard
        label="24h volume"
        value={`$${Math.round(totalVolume / 1_000_000_000).toLocaleString()}B`}
        helper="Across spot + perp venues"
      />
      <StatCard
        label="Top L1 by TVL"
        value={dominantChain.name}
        helper={`${dominantChain.symbol} • $${Math.round(
          dominantChain.tvlUsd / 1_000_000_000,
        ).toLocaleString()}B TVL`}
      />
    </section>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
};

function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-slate-50">{value}</p>
      {helper && <p className="mt-1 text-[11px] text-slate-400">{helper}</p>}
    </div>
  );
}

