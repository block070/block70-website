import type { MarketSummaryResponse } from "@/lib/api";
import { COINS, CHAINS } from "@/lib/crypto-mock";

type Props = {
  summary?: MarketSummaryResponse | null;
};

export function MarketStats({ summary }: Props) {
  const g = summary?.global;
  const totalMarketCap =
    typeof g?.total_market_cap_usd === "number" && Number.isFinite(g.total_market_cap_usd)
      ? g.total_market_cap_usd
      : COINS.reduce((sum, c) => sum + c.marketCapUsd, 0);
  const totalVolume =
    typeof g?.total_volume_usd === "number" && Number.isFinite(g.total_volume_usd)
      ? g.total_volume_usd
      : COINS.reduce((sum, c) => sum + c.volume24hUsd, 0);
  const dominantChain = CHAINS[0];

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {summary?.as_of ? (
        <p className="col-span-full text-[10px] text-slate-500">
          Market aggregates: last updated{" "}
          <time dateTime={summary.as_of}>
            {new Date(summary.as_of).toLocaleString(undefined, {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </time>
          {summary.source ? ` · ${summary.source}` : ""}
        </p>
      ) : null}
      <StatCard
        label="Total market cap"
        value={`$${Math.round(totalMarketCap / 1_000_000_000).toLocaleString()}B`}
        helper={
          g?.total_market_cap_usd != null
            ? "Global crypto (CoinGecko)"
            : "Aggregated across tracked majors"
        }
      />
      <StatCard
        label="24h volume"
        value={`$${Math.round(totalVolume / 1_000_000_000).toLocaleString()}B`}
        helper={g?.total_volume_usd != null ? "Reported 24h volume" : "Across spot + perp venues"}
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
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-50">{value}</p>
      {helper && <p className="mt-1 text-[11px] text-slate-400">{helper}</p>}
    </div>
  );
}
