import Link from "next/link";

import { formatPrice } from "@/lib/format";
import { TRENDING_COINS } from "@/lib/crypto-mock";

export function TrendingCoins() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Trending
          </p>
          <p className="text-[11px] text-slate-500">
            Signals from volume, price momentum, and narratives.
          </p>
        </div>
        <Link
          href="/trending"
          className="text-[11px] font-medium text-emerald-300 hover:text-emerald-200"
        >
          View all
        </Link>
      </div>
      <div className="space-y-2">
        {TRENDING_COINS.map((coin) => (
          <Link
            key={coin.id}
            href={`/coins/${coin.slug}`}
            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 hover:border-emerald-500/60 hover:bg-slate-900/80"
          >
            <div>
              <p className="text-sm font-medium text-slate-50">
                {coin.name}
              </p>
              <p className="text-[11px] text-slate-400">{coin.symbol}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-100">
                {formatPrice(coin.priceUsd)}
              </p>
              <p
                className={`text-[11px] ${
                  coin.change24hPct >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {coin.change24hPct.toFixed(2)}%
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

