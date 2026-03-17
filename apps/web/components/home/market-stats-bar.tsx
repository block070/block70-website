import Link from "next/link";

type PriceRow = { symbol: string; price: number; change24h: number };

const DEFAULT_PRICES: PriceRow[] = [
  { symbol: "BTC", price: 67_200, change24h: 2.1 },
  { symbol: "ETH", price: 3_450, change24h: 1.8 },
  { symbol: "SOL", price: 178, change24h: 8.2 },
];

function formatPrice(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function MarketStatsBar({
  prices = DEFAULT_PRICES,
  topGainer = "SOL",
  topLoser = "DOGE",
}: {
  prices?: PriceRow[];
  topGainer?: string;
  topLoser?: string;
}) {
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
      {prices.map((row) => (
        <Link
          key={row.symbol}
          href={`/coins/${row.symbol.toLowerCase()}`}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-slate-800/80"
        >
          <span className="text-xs font-semibold text-slate-200">
            {row.symbol}
          </span>
          <span className="text-xs text-slate-100">
            {formatPrice(row.price)}
          </span>
          <span
            className={
              row.change24h >= 0
                ? "text-[10px] text-emerald-400"
                : "text-[10px] text-rose-400"
            }
          >
            {row.change24h >= 0 ? "+" : ""}
            {row.change24h}%
          </span>
        </Link>
      ))}
      <span className="h-4 w-px bg-slate-700" />
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
        <span>Sample majors</span>
        <span>·</span>
        <span>Top gainer</span>
        <Link
          href={`/coins/${topGainer.toLowerCase()}`}
          className="text-xs font-medium text-emerald-400 hover:underline"
        >
          {topGainer}
        </Link>
        <span>·</span>
        <span>Top loser</span>
        <Link
          href={`/coins/${topLoser.toLowerCase()}`}
          className="text-xs font-medium text-rose-400 hover:underline"
        >
          {topLoser}
        </Link>
      </div>
    </section>
  );
}
