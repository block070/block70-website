import Link from "next/link";

import { Block70Gauge } from "@/components/coins/block70-gauge";
import type { InvestmentLabel } from "@/lib/coin-signal-label";
import { getExchangeBuyUrls } from "@/lib/exchange-buy-urls";
import type { Coin } from "@/lib/crypto-mock";
import { formatChangePct, formatCompactUsd, formatPrice } from "@/lib/format";
import { clsx } from "clsx";

type Props = {
  coin: Coin;
  block70Score: number;
  investmentLabel: InvestmentLabel;
};

function labelStyles(label: InvestmentLabel) {
  if (label === "Strong Buy")
    return "border-emerald-500/50 bg-emerald-500/15 text-emerald-300";
  if (label === "Sell") return "border-red-500/50 bg-red-500/15 text-red-300";
  return "border-amber-500/45 bg-amber-500/12 text-amber-200";
}

export function CoinHeroConversion({ coin, block70Score, investmentLabel }: Props) {
  const links = getExchangeBuyUrls(coin.symbol, coin.slug);

  return (
    <section className="rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-4 md:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Live price
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">
                {coin.name}
              </h1>
              <span className="text-sm text-slate-400">{coin.symbol}</span>
              {coin.rank > 0 && (
                <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] text-slate-300">
                  Rank #{coin.rank}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-3xl font-semibold tabular-nums text-slate-50 md:text-4xl">
                {formatPrice(coin.priceUsd)}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                <span className="text-slate-500">24h </span>
                <span
                  className={
                    typeof coin.change24hPct === "number" && Number.isFinite(coin.change24hPct)
                      ? coin.change24hPct >= 0
                        ? "font-medium text-emerald-400"
                        : "font-medium text-red-400"
                      : "text-slate-500"
                  }
                >
                  {formatChangePct(coin.change24hPct)}
                </span>
                <span className="text-slate-600"> · </span>
                <span className="text-slate-500">7d </span>
                <span
                  className={
                    typeof coin.change7dPct === "number" && Number.isFinite(coin.change7dPct)
                      ? coin.change7dPct >= 0
                        ? "font-medium text-emerald-400"
                        : "font-medium text-red-400"
                      : "text-slate-500"
                  }
                >
                  {formatChangePct(coin.change7dPct)}
                </span>
              </p>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-slate-500">Market cap</p>
                <p className="font-medium text-slate-100">{formatCompactUsd(coin.marketCapUsd)}</p>
              </div>
              <div>
                <p className="text-slate-500">24h volume</p>
                <p className="font-medium text-slate-100">{formatCompactUsd(coin.volume24hUsd)}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={links.coinbase}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-[#0052FF] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0047e0]"
            >
              Buy on Coinbase
            </a>
            <a
              href={links.binanceUs}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-[#F0B90B] px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-[#d9a60a]"
            >
              Buy on Binance.US
            </a>
            <a
              href={links.kraken}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-[#5741d9] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4a36c4]"
            >
              Buy on Kraken
            </a>
          </div>
          <p className="text-[10px] text-slate-500">
            Third-party links. Block70 does not execute trades. Not financial advice.
          </p>
        </div>

        <div className="flex w-full min-w-[200px] shrink-0 flex-col items-stretch gap-3 overflow-visible border-t border-slate-800 pt-6 sm:items-end lg:w-auto lg:max-w-sm lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          {coin.categorySlug ? (
            <div className="w-full text-left sm:text-right">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Category</p>
              <Link
                href={`/discover/${encodeURIComponent(coin.categorySlug)}`}
                className="mt-0.5 inline-block text-sm font-medium text-blue-400 transition hover:text-blue-300 hover:underline"
              >
                {coin.categoryLabel ?? coin.categorySlug.replace(/-/g, " ")}
              </Link>
            </div>
          ) : null}
          <Block70Gauge score={block70Score} />
          <span
            className={clsx(
              "rounded-full border px-4 py-1.5 text-sm font-semibold",
              labelStyles(investmentLabel)
            )}
          >
            {investmentLabel}
          </span>
          <Link
            href="/legal/disclaimer"
            className="text-[10px] text-slate-500 underline hover:text-slate-400"
          >
            How we label signals
          </Link>
        </div>
      </div>
    </section>
  );
}
