import Link from "next/link";
import { CoinSymbol } from "@/components/market/coin-symbol";

function formatCompact(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

type HeroMarketOverviewProps = {
  totalMarketCap?: number;
  volume24h?: number;
  btcDominance?: number;
  ethDominance?: number;
  topTrendingCoin?: { symbol: string; slug?: string; change24h: number; logoUrl?: string | null };
};

export function HeroMarketOverview({
  totalMarketCap,
  volume24h,
  btcDominance,
  ethDominance,
  topTrendingCoin,
}: HeroMarketOverviewProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-6 shadow-sm dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950 dark:border-slate-800 md:p-8">
      <div className="relative z-10">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--b70-text)] md:text-2xl">
          Block70 is a crypto intelligence terminal for operators who care about
          real edge, not noise.
        </h1>
        <p className="mt-2 text-sm text-[var(--b70-text-muted)] max-w-2xl">
          One place to scan signals, opportunities, smart wallets, and narratives
          across chains—built for desks that actually pull the trigger.
        </p>
        <h2 className="mt-4 text-xs font-semibold uppercase tracking-widest text-[var(--b70-text-muted)]">
          Global crypto market
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--b70-text-muted)]">
              Total market cap
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--b70-text)] md:text-3xl">
              {typeof totalMarketCap === "number"
                ? formatCompact(totalMarketCap)
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
              BTC dominance
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400 md:text-3xl">
              {typeof btcDominance === "number"
                ? `${btcDominance.toFixed(1)}%`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--b70-text-muted)]">
              ETH dominance
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--b70-text)] md:text-3xl">
              {typeof ethDominance === "number"
                ? `${ethDominance.toFixed(1)}%`
                : "—"}
            </p>
          </div>
        </div>
        {topTrendingCoin ? (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-bg)] px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs text-[var(--b70-text-muted)]">Top trending</p>
            <Link
              href={`/coins/${topTrendingCoin.slug ?? topTrendingCoin.symbol.toLowerCase()}`}
              className="font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              <CoinSymbol
                symbol={topTrendingCoin.symbol}
                logoUrl={topTrendingCoin.logoUrl}
                size="sm"
              />
            </Link>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              +{topTrendingCoin.change24h}% 24h
            </span>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-[var(--b70-border)] bg-[var(--b70-bg)] px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-xs text-[var(--b70-text-muted)]">
              Market-level stats will appear here once connected to a live
              market data source.
            </p>
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
    </section>
  );
}
