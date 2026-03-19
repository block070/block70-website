import Link from "next/link";

export type HeatmapToken = {
  symbol: string;
  change24h: number;
};

function colorForChange(change: number): string {
  if (change >= 5) return "bg-emerald-500";
  if (change >= 2) return "bg-emerald-600";
  if (change >= 0) return "bg-emerald-700/80";
  if (change >= -2) return "bg-rose-700/80";
  if (change >= -5) return "bg-rose-600";
  return "bg-rose-500";
}

type MarketHeatmapProps = {
  tokens?: HeatmapToken[];
};

export function MarketHeatmap({ tokens = [] }: MarketHeatmapProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <h3 className="text-sm font-semibold text-slate-50">
        Crypto market heatmap
      </h3>
      <p className="mt-0.5 text-[11px] text-slate-400">
        Color-coded 24h price performance
      </p>
      {tokens.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          Live heatmap data temporarily unavailable.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {tokens.map((t) => (
            <Link
              key={t.symbol}
              href={`/coins/${t.symbol.toLowerCase()}`}
              className={`rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 ${colorForChange(t.change24h)}`}
              title={`${t.symbol} ${t.change24h >= 0 ? "+" : ""}${t.change24h}%`}
            >
              {t.symbol}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
