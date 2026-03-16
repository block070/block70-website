import Link from "next/link";

export type HeatmapToken = {
  symbol: string;
  change24h: number;
};

const DEFAULT_TOKENS: HeatmapToken[] = [
  { symbol: "BTC", change24h: 2.1 },
  { symbol: "ETH", change24h: 1.8 },
  { symbol: "SOL", change24h: 8.2 },
  { symbol: "AVAX", change24h: 5.1 },
  { symbol: "LINK", change24h: 4.8 },
  { symbol: "UNI", change24h: 4.2 },
  { symbol: "DOGE", change24h: -3.2 },
  { symbol: "ADA", change24h: -2.1 },
  { symbol: "XRP", change24h: -1.8 },
  { symbol: "DOT", change24h: -1.4 },
  { symbol: "ATOM", change24h: 3.9 },
  { symbol: "NEAR", change24h: 3.5 },
  { symbol: "APT", change24h: 3.2 },
  { symbol: "ARB", change24h: 2.9 },
  { symbol: "OP", change24h: 2.6 },
  { symbol: "MATIC", change24h: 1.2 },
  { symbol: "LTC", change24h: -1.2 },
  { symbol: "BCH", change24h: -1.0 },
];

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

export function MarketHeatmap({ tokens = DEFAULT_TOKENS }: MarketHeatmapProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <h3 className="text-sm font-semibold text-slate-50">
        Crypto market heatmap
      </h3>
      <p className="mt-0.5 text-[11px] text-slate-400">
        Color-coded 24h price performance
      </p>
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
    </section>
  );
}
