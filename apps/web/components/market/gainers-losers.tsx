import Link from "next/link";

export type GainersLosersRow = {
  symbol: string;
  price: number;
  change24h: number;
  marketCap: number;
};

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
  gainers = [],
  losers = [],
}: GainersLosersProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h3 className="text-sm font-semibold text-slate-50">Top 10 gainers</h3>
        <p className="mt-0.5 text-[11px] text-slate-400">24h price change</p>
        {gainers.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            Live market data temporarily unavailable.
          </p>
        ) : (
          <ul className="mt-3 space-y-0.5">
            {gainers.slice(0, 10).map((row) => (
              <li key={row.symbol}>
                <Row row={row} isGainer={true} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h3 className="text-sm font-semibold text-slate-50">Top 10 losers</h3>
        <p className="mt-0.5 text-[11px] text-slate-400">24h price change</p>
        {losers.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            Live market data temporarily unavailable.
          </p>
        ) : (
          <ul className="mt-3 space-y-0.5">
            {losers.slice(0, 10).map((row) => (
              <li key={row.symbol}>
                <Row row={row} isGainer={false} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
