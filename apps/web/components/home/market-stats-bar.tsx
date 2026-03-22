import Link from "next/link";
import { CoinSymbol } from "@/components/market/coin-symbol";

type PriceRow = { symbol: string; slug?: string; logoUrl?: string | null; price: number; change24h: number };
type GainerLoser = { symbol: string; slug?: string; logoUrl?: string | null };

function formatPrice(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function MarketStatsBar({
  prices = [],
  topGainer,
  topLoser,
}: {
  prices?: PriceRow[];
  topGainer?: GainerLoser;
  topLoser?: GainerLoser;
}) {
  const hasRows = prices.length > 0;
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] px-4 py-3 shadow-sm">
      {hasRows ? prices.map((row) => (
        <Link
          key={row.symbol}
          href={`/coins/${row.slug ?? row.symbol.toLowerCase()}`}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-[var(--b70-border)] dark:hover:bg-slate-800/80"
        >
          <CoinSymbol symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
          <span className="text-xs text-[var(--b70-text)]">
            {formatPrice(row.price)}
          </span>
          <span
            className={
              row.change24h >= 0
                ? "text-[10px] text-emerald-600 dark:text-emerald-400"
                : "text-[10px] text-rose-600 dark:text-rose-400"
            }
          >
            {row.change24h >= 0 ? "+" : ""}
            {row.change24h}%
          </span>
        </Link>
      )) : (
        <p className="text-xs text-[var(--b70-text-muted)]">
          Live market prices temporarily unavailable.
        </p>
      )}
      <span className="h-4 w-px bg-[var(--b70-border)]" />
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--b70-text-muted)]">
        <span>Live majors</span>
        <span>·</span>
        <span>Top gainer</span>
        {topGainer ? (
          <Link
            href={`/coins/${topGainer.slug ?? topGainer.symbol.toLowerCase()}`}
            className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            <CoinSymbol symbol={topGainer.symbol} logoUrl={topGainer.logoUrl} size="sm" />
          </Link>
        ) : (
          <span className="text-xs text-[var(--b70-text-muted)]">—</span>
        )}
        <span>·</span>
        <span>Top loser</span>
        {topLoser ? (
          <Link
            href={`/coins/${topLoser.slug ?? topLoser.symbol.toLowerCase()}`}
            className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
          >
            <CoinSymbol symbol={topLoser.symbol} logoUrl={topLoser.logoUrl} size="sm" />
          </Link>
        ) : (
          <span className="text-xs text-[var(--b70-text-muted)]">—</span>
        )}
      </div>
    </section>
  );
}
