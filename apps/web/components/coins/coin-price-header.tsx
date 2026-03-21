import type { Coin } from "@/lib/crypto-mock";

type Props = {
  coin: Coin;
};

export function CoinPriceHeader({ coin }: Props) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          Market overview
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <h1 className="text-xl font-semibold text-slate-50">
            {coin.name}
          </h1>
          <span className="text-[11px] text-slate-400">{coin.symbol}</span>
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
            Rank #{coin.rank}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold text-slate-50">
            ${coin.priceUsd.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            24h:{" "}
            <span
              className={
                typeof coin.change24hPct === "number" && !Number.isNaN(coin.change24hPct)
                  ? coin.change24hPct >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                  : "text-slate-500"
              }
            >
              {typeof coin.change24hPct === "number" && !Number.isNaN(coin.change24hPct)
                ? `${coin.change24hPct >= 0 ? "+" : ""}${coin.change24hPct.toFixed(2)}%`
                : "—"}
            </span>{" "}
            · 7d:{" "}
            <span
              className={
                typeof coin.change7dPct === "number" && !Number.isNaN(coin.change7dPct)
                  ? coin.change7dPct >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                  : "text-slate-500"
              }
            >
              {typeof coin.change7dPct === "number" && !Number.isNaN(coin.change7dPct)
                ? `${coin.change7dPct >= 0 ? "+" : ""}${coin.change7dPct.toFixed(2)}%`
                : "—"}
            </span>
          </p>
        </div>
        <div className="flex gap-4 text-[11px] text-slate-400">
          <div>
            <p className="text-slate-400">Market cap</p>
            <p className="mt-0.5 text-slate-100">
              $
              {Math.round(
                coin.marketCapUsd / 1_000_000_000,
              ).toLocaleString()}
              B
            </p>
          </div>
          <div>
            <p className="text-slate-400">24h volume</p>
            <p className="mt-0.5 text-slate-100">
              $
              {Math.round(
                coin.volume24hUsd / 1_000_000_000,
              ).toLocaleString()}
              B
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

