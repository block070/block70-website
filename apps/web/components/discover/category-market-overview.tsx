import Link from "next/link";
import { formatChangePct } from "@/lib/format";

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
  /** Sector / category aggregate: 24h change in total market cap (percentage points). */
  marketCapChange24hPct?: number | null;
  dominancePct?: number | null;
  dominanceHint?: string;
  coinCount?: number | null;
  topGainer?: { symbol: string; slug: string; change24h: number };
  topLoser?: { symbol: string; slug: string; change24h: number };
};

export function CategoryMarketOverview({
  categoryName,
  marketCap,
  volume24h,
  marketCapChange24hPct,
  dominancePct,
  dominanceHint,
  coinCount,
  topGainer,
  topLoser,
}: CategoryMarketOverviewProps) {
  const sectorMode =
    marketCapChange24hPct != null ||
    (typeof dominancePct === "number" && Number.isFinite(dominancePct)) ||
    typeof coinCount === "number";

  if (sectorMode) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-6 shadow-sm dark:border-slate-800 md:p-8">
        <div className="relative z-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--b70-text-muted)]">
            {categoryName} · sector snapshot
          </h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
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
                24h sector cap Δ
              </p>
              <p
                className={`mt-1 text-2xl font-bold md:text-3xl ${
                  typeof marketCapChange24hPct === "number" && Number.isFinite(marketCapChange24hPct)
                    ? marketCapChange24hPct >= 0
                      ? "text-emerald-500 dark:text-emerald-400"
                      : "text-rose-500 dark:text-rose-400"
                    : "text-[var(--b70-text)]"
                }`}
              >
                {typeof marketCapChange24hPct === "number" && Number.isFinite(marketCapChange24hPct)
                  ? formatChangePct(marketCapChange24hPct)
                  : "—"}
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
                Dominance
              </p>
              <p
                className="mt-1 text-2xl font-bold text-[var(--b70-text)] md:text-3xl"
                title={dominanceHint}
              >
                {typeof dominancePct === "number" && Number.isFinite(dominancePct)
                  ? `${dominancePct.toFixed(2)}%`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--b70-text-muted)]">
                Coins (sector)
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--b70-text)] md:text-3xl">
                {typeof coinCount === "number" ? coinCount : "—"}
              </p>
            </div>
          </div>
          {(topGainer || topLoser) && (
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--b70-text-muted)]">
                  Top gainer (list)
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
                  Top loser (list)
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
          )}
        </div>
      </section>
    );
  }

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
