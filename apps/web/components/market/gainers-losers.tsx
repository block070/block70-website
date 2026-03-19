import Link from "next/link";
import { useState } from "react";

export type GainersLosersRow = {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
};

function formatPrice(n: number): string {
  // Round to nearest ten-thousandth (0.0001) for UI display only
  const rounded = Math.round(n * 10000) / 10000;
  if (rounded >= 1000) return `$${(rounded / 1000).toFixed(1)}k`;
  if (rounded >= 1) return `$${rounded.toFixed(4)}`;
  return `$${rounded.toFixed(4)}`;
}

function formatMcap(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

function formatVolume(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

type SortKey = "symbol" | "name" | "price" | "change24h" | "volume24h" | "marketCap";

type SortState = {
  key: SortKey;
  direction: "asc" | "desc";
};

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
      className="rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-800/60"
    >
      <div className="grid grid-cols-6 items-center gap-3">
        <span className="font-medium text-slate-100">{row.symbol}</span>
        <span className="truncate text-slate-300">{row.name}</span>
        <span className="text-slate-300">{formatPrice(row.price)}</span>
        <span className={isGainer ? "text-emerald-400" : "text-rose-400"}>
          {row.change24h >= 0 ? "+" : ""}
          {Math.round(row.change24h * 1000) / 1000}%
        </span>
        <span className="text-slate-500">
          {formatVolume(row.volume24h)}
        </span>
        <span className="text-slate-500">
          {formatMcap(row.marketCap)}
        </span>
      </div>
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
  const [gainersSort, setGainersSort] = useState<SortState>({
    key: "change24h",
    direction: "desc",
  });
  const [losersSort, setLosersSort] = useState<SortState>({
    key: "change24h",
    direction: "asc",
  });

  const sortRows = (rows: GainersLosersRow[], sort: SortState) => {
    const sorted = [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sort.direction === "asc" ? -1 : 1;
      return sort.direction === "asc" ? 1 : -1;
    });
    return sorted.slice(0, 10);
  };

  const displayedGainers = sortRows(gainers, gainersSort);
  const displayedLosers = sortRows(losers, losersSort);

  const headerBase =
    "flex items-center gap-1 cursor-pointer select-none hover:text-slate-300";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h3 className="text-sm font-semibold text-slate-50">Top 10 Gainers</h3>
        <p className="mt-0.5 text-[11px] text-slate-400">24H Price Change</p>
        <div className="mt-3 grid grid-cols-6 gap-3 border-b border-slate-800 px-3 pb-2 text-[10px] uppercase tracking-wide text-slate-500">
          <button
            type="button"
            className={headerBase}
            onClick={() =>
              setGainersSort((prev) => ({
                key: "symbol",
                direction: prev.key === "symbol" && prev.direction === "asc" ? "desc" : "asc",
              }))
            }
          >
            <span>Symbol</span>
          </button>
          <button
            type="button"
            className={headerBase}
            onClick={() =>
              setGainersSort((prev) => ({
                key: "name",
                direction: prev.key === "name" && prev.direction === "asc" ? "desc" : "asc",
              }))
            }
          >
            <span>Coin</span>
          </button>
          <button
            type="button"
            className={headerBase}
            onClick={() =>
              setGainersSort((prev) => ({
                key: "price",
                direction: prev.key === "price" && prev.direction === "asc" ? "desc" : "asc",
              }))
            }
          >
            <span>Price</span>
          </button>
          <button
            type="button"
            className={headerBase}
            onClick={() =>
              setGainersSort((prev) => ({
                key: "change24h",
                direction: prev.key === "change24h" && prev.direction === "asc" ? "desc" : "asc",
              }))
            }
          >
            <span>24H Change</span>
          </button>
          <button
            type="button"
            className={headerBase}
            onClick={() =>
              setGainersSort((prev) => ({
                key: "volume24h",
                direction: prev.key === "volume24h" && prev.direction === "asc" ? "desc" : "asc",
              }))
            }
          >
            <span>24H Volume</span>
          </button>
          <button
            type="button"
            className={headerBase}
            onClick={() =>
              setGainersSort((prev) => ({
                key: "marketCap",
                direction: prev.key === "marketCap" && prev.direction === "asc" ? "desc" : "asc",
              }))
            }
          >
            <span>Market Cap</span>
          </button>
        </div>
        {gainers.length === 0 ? (
          <p className="mt-3 px-3 text-xs text-slate-500">
            Live market data temporarily unavailable.
          </p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {displayedGainers.map((row) => (
              <li key={`${row.symbol}-g`}>
                <Row row={row} isGainer={true} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h3 className="text-sm font-semibold text-slate-50">Top 10 Losers</h3>
        <p className="mt-0.5 text-[11px] text-slate-400">24H Price Change</p>
        <div className="mt-3 grid grid-cols-6 gap-3 border-b border-slate-800 px-3 pb-2 text-[10px] uppercase tracking-wide text-slate-500">
          <button
            type="button"
            className={headerBase}
            onClick={() =>
              setLosersSort((prev) => ({
                key: "symbol",
                direction: prev.key === "symbol" && prev.direction === "asc" ? "desc" : "asc",
              }))
            }
          >
            <span>Symbol</span>
          </button>
          <button
            type="button"
            className={headerBase}
            onClick={() =>
              setLosersSort((prev) => ({
                key: "name",
                direction: prev.key === "name" && prev.direction === "asc" ? "desc" : "asc",
              }))
            }
          >
            <span>Coin</span>
          </button>
          <button
            type="button"
            className={headerBase}
            onClick={() =>
              setLosersSort((prev) => ({
                key: "price",
                direction: prev.key === "price" && prev.direction === "asc" ? "desc" : "asc",
              }))
            }
          >
            <span>Price</span>
          </button>
          <button
            type="button"
            className={headerBase}
            onClick={() =>
              setLosersSort((prev) => ({
                key: "change24h",
                direction: prev.key === "change24h" && prev.direction === "asc" ? "desc" : "asc",
              }))
            }
          >
            <span>24H Change</span>
          </button>
          <button
            type="button"
            className={headerBase}
            onClick={() =>
              setLosersSort((prev) => ({
                key: "volume24h",
                direction:
                  prev.key === "volume24h" && prev.direction === "asc" ? "desc" : "asc",
              }))
            }
          >
            <span>24H Volume</span>
          </button>
          <button
            type="button"
            className={headerBase}
            onClick={() =>
              setLosersSort((prev) => ({
                key: "marketCap",
                direction:
                  prev.key === "marketCap" && prev.direction === "asc" ? "desc" : "asc",
              }))
            }
          >
            <span>Market Cap</span>
          </button>
        </div>
        {losers.length === 0 ? (
          <p className="mt-3 px-3 text-xs text-slate-500">
            Live market data temporarily unavailable.
          </p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {displayedLosers.map((row) => (
              <li key={`${row.symbol}-l`}>
                <Row row={row} isGainer={false} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
