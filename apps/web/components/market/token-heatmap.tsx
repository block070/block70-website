"use client";

import Link from "next/link";

type TokenRow = {
  symbol: string;
  change24h: number;
  volume: number;
  intensity: number;
};

type TokenHeatmapProps = {
  tokens?: TokenRow[];
  maxItems?: number;
};

const DEFAULT_TOKENS: TokenRow[] = [
  { symbol: "BTC", change24h: 2.1, volume: 40_000_000_000, intensity: 0.95 },
  { symbol: "ETH", change24h: 1.8, volume: 18_000_000_000, intensity: 0.88 },
  { symbol: "SOL", change24h: 8.2, volume: 4_500_000_000, intensity: 0.92 },
  { symbol: "AVAX", change24h: 5.1, volume: 800_000_000, intensity: 0.7 },
  { symbol: "LINK", change24h: 4.8, volume: 600_000_000, intensity: 0.65 },
  { symbol: "DOGE", change24h: -3.2, volume: 2_000_000_000, intensity: 0.5 },
  { symbol: "ADA", change24h: -2.1, volume: 400_000_000, intensity: 0.4 },
  { symbol: "XRP", change24h: -1.8, volume: 1_200_000_000, intensity: 0.45 },
];

function intensityToColor(intensity: number): string {
  if (intensity >= 0.8) return "bg-emerald-500/80";
  if (intensity >= 0.5) return "bg-emerald-600/70";
  if (intensity >= 0.3) return "bg-amber-600/60";
  return "bg-slate-600/50";
}

export function TokenHeatmap({
  tokens = DEFAULT_TOKENS,
  maxItems = 12,
}: TokenHeatmapProps) {
  const list = tokens.slice(0, maxItems);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <h3 className="text-sm font-semibold text-slate-50">Token heatmap</h3>
      <p className="mt-0.5 text-[11px] text-slate-400">
        Market activity by color intensity
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {list.map((t) => (
          <Link
            key={t.symbol}
            href={`/coins/${t.symbol.toLowerCase()}`}
            className={`rounded-lg px-3 py-2 text-sm font-medium text-slate-100 transition-opacity hover:opacity-90 ${intensityToColor(t.intensity)}`}
            title={`${t.symbol} ${t.change24h >= 0 ? "+" : ""}${t.change24h}% 24h`}
          >
            {t.symbol}
          </Link>
        ))}
      </div>
    </div>
  );
}
