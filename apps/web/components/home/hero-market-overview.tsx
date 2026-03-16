import Link from "next/link";

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
  topTrendingCoin?: { symbol: string; change24h: number };
};

export function HeroMarketOverview({
  totalMarketCap = 2_400_000_000_000,
  volume24h = 80_000_000_000,
  btcDominance = 52.5,
  ethDominance = 17.2,
  topTrendingCoin = { symbol: "SOL", change24h: 8.2 },
}: HeroMarketOverviewProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6 md:p-8">
      <div className="relative z-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Global crypto market
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              Total market cap
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-50 md:text-3xl">
              {formatCompact(totalMarketCap)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              24h volume
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-50 md:text-3xl">
              {formatCompact(volume24h)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              BTC dominance
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-400 md:text-3xl">
              {btcDominance.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              ETH dominance
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-200 md:text-3xl">
              {ethDominance.toFixed(1)}%
            </p>
          </div>
        </div>
        {topTrendingCoin && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3">
            <p className="text-xs text-slate-400">Top trending</p>
            <Link
              href={`/coins/${topTrendingCoin.symbol.toLowerCase()}`}
              className="font-semibold text-emerald-400 hover:text-emerald-300"
            >
              {topTrendingCoin.symbol}
            </Link>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
              +{topTrendingCoin.change24h}% 24h
            </span>
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
    </section>
  );
}
