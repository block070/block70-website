import Link from "next/link";

export type GainersLosersRow = {
  symbol: string;
  price: number;
  change24h: number;
  marketCap: number;
};

const DEFAULT_GAINERS: GainersLosersRow[] = [
  { symbol: "SOL", price: 178, change24h: 8.2, marketCap: 82_000_000_000 },
  { symbol: "AVAX", price: 42, change24h: 5.1, marketCap: 16_000_000_000 },
  { symbol: "LINK", price: 18.5, change24h: 4.8, marketCap: 11_000_000_000 },
  { symbol: "UNI", price: 12.2, change24h: 4.2, marketCap: 7_200_000_000 },
  { symbol: "ATOM", price: 9.8, change24h: 3.9, marketCap: 3_800_000_000 },
  { symbol: "NEAR", price: 6.1, change24h: 3.5, marketCap: 6_200_000_000 },
  { symbol: "APT", price: 14.2, change24h: 3.2, marketCap: 5_100_000_000 },
  { symbol: "ARB", price: 1.02, change24h: 2.9, marketCap: 2_700_000_000 },
  { symbol: "OP", price: 2.45, change24h: 2.6, marketCap: 2_400_000_000 },
  { symbol: "INJ", price: 28, change24h: 2.4, marketCap: 2_600_000_000 },
];

const DEFAULT_LOSERS: GainersLosersRow[] = [
  { symbol: "DOGE", price: 0.38, change24h: -3.2, marketCap: 55_000_000_000 },
  { symbol: "ADA", price: 0.58, change24h: -2.1, marketCap: 20_000_000_000 },
  { symbol: "XRP", price: 0.52, change24h: -1.8, marketCap: 28_000_000_000 },
  { symbol: "SHIB", price: 0.000024, change24h: -1.5, marketCap: 14_000_000_000 },
  { symbol: "DOT", price: 7.2, change24h: -1.4, marketCap: 9_200_000_000 },
  { symbol: "LTC", price: 98, change24h: -1.2, marketCap: 7_300_000_000 },
  { symbol: "BCH", price: 420, change24h: -1.0, marketCap: 8_200_000_000 },
  { symbol: "ETC", price: 28, change24h: -0.9, marketCap: 4_100_000_000 },
  { symbol: "FIL", price: 6.8, change24h: -0.8, marketCap: 3_200_000_000 },
  { symbol: "ALGO", price: 0.22, change24h: -0.7, marketCap: 1_800_000_000 },
];

function formatPrice(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(6)}`;
}

function formatMcap(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

function Row({
  row,
  isGainer,
}: {
  row: GainersLosersRow;
  isGainer: boolean;
}) {
  return (
    <Link
      href={`/coins/${row.symbol.toLowerCase()}`}
      className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-800/60"
    >
      <span className="font-medium text-slate-100">{row.symbol}</span>
      <span className="text-slate-300">{formatPrice(row.price)}</span>
      <span
        className={
          isGainer ? "text-emerald-400" : "text-rose-400"
        }
      >
        {row.change24h >= 0 ? "+" : ""}
        {row.change24h}%
      </span>
      <span className="hidden text-slate-500 sm:inline">
        {formatMcap(row.marketCap)}
      </span>
    </Link>
  );
}

type GainersLosersProps = {
  gainers?: GainersLosersRow[];
  losers?: GainersLosersRow[];
};

export function GainersLosers({
  gainers = DEFAULT_GAINERS,
  losers = DEFAULT_LOSERS,
}: GainersLosersProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h3 className="text-sm font-semibold text-slate-50">Top 10 gainers</h3>
        <p className="mt-0.5 text-[11px] text-slate-400">24h price change</p>
        <ul className="mt-3 space-y-0.5">
          {gainers.slice(0, 10).map((row) => (
            <li key={row.symbol}>
              <Row row={row} isGainer={true} />
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h3 className="text-sm font-semibold text-slate-50">Top 10 losers</h3>
        <p className="mt-0.5 text-[11px] text-slate-400">24h price change</p>
        <ul className="mt-3 space-y-0.5">
          {losers.slice(0, 10).map((row) => (
            <li key={row.symbol}>
              <Row row={row} isGainer={false} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
