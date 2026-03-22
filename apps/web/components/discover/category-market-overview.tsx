import Link from "next/link";

function formatCompact(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

type CategoryMarketOverviewProps = {
  categoryName: string;
  marketCap?: number;
  volume24h?: number;
  topGainer?: { symbol: string; slug: string; change24h: number };
  topLoser?: { symbol: string; slug: string; change24h: number };
};

export function CategoryMarketOverview({
  categoryName,
  marketCap,
  volume24h,
  topGainer,
  topLoser,
}: CategoryMarketOverviewProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-6 shadow-sm dark:border-slate-800 md:p-8">
      <div className="relative z-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--b70-text-muted)]">
          {categoryName} market cap
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--b70-text-muted)]">
              Market cap
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--b70-text)] md:text-3xl">
              {typeof marketCap === "number" ? formatCompact(marketCap) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--b70-text-muted)]">
              24h volume
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--b70-text)] md:text-3xl">
              {typeof volume24h === "number" ? formatCompact(volume24h) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--b70-text-muted)]">
              Top Gainer
            </p>
            {topGainer ? (
              <Link
                href={`/coins/${topGainer.slug}`}
                className="mt-1 block text-xl font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 md:text-2xl"
              >
                {topGainer.symbol} +{topGainer.change24h.toFixed(2)}%
              </Link>
            ) : (
              <p className="mt-1 text-xl font-bold text-[var(--b70-text-muted)] md:text-2xl">
                —
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--b70-text-muted)]">
              Top Loser
            </p>
            {topLoser ? (
              <Link
                href={`/coins/${topLoser.slug}`}
                className="mt-1 block text-xl font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 md:text-2xl"
              >
                {topLoser.symbol} {topLoser.change24h.toFixed(2)}%
              </Link>
            ) : (
              <p className="mt-1 text-xl font-bold text-[var(--b70-text-muted)] md:text-2xl">
                —
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
