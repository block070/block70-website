import Link from "next/link";

import type { InvestmentLabel } from "@/lib/coin-signal-label";
import { formatCompactUsd, formatPrice } from "@/lib/format";

type Props = {
  name: string;
  symbol: string;
  slug: string;
  category: string | null;
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  change24hPct: number;
  change7dPct: number;
  block70Score: number;
  investmentLabel: InvestmentLabel;
};

export function CoinInvestmentAnalysis({
  name,
  symbol,
  slug,
  category,
  priceUsd,
  marketCapUsd,
  volume24hUsd,
  change24hPct,
  change7dPct,
  block70Score,
  investmentLabel,
}: Props) {
  const cat = category?.trim() || "the broader crypto market";
  const title = `${name} (${symbol}) price analysis & outlook — Block70`;

  return (
    <article
      className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 md:p-6"
      itemScope
      itemType="https://schema.org/Article"
    >
      <meta itemProp="headline" content={title} />
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <p className="mt-2 text-xs text-slate-500">
        Last updated from market data · Educational only, not investment advice.
      </p>

      <div className="prose prose-invert prose-sm mt-4 max-w-none text-slate-300">
        <p>
          <strong>{name}</strong> (<span itemProp="tickerSymbol">{symbol}</span>) trades near{" "}
          <strong>{formatPrice(priceUsd)}</strong> with a Block70 composite score of{" "}
          <strong>{block70Score}</strong> and a current signal label of{" "}
          <strong>{investmentLabel}</strong>. Short-term momentum shows a 24-hour change of{" "}
          {Number.isFinite(change24hPct) ? `${change24hPct.toFixed(2)}%` : "N/A"} and a 7-day change
          of {Number.isFinite(change7dPct) ? `${change7dPct.toFixed(2)}%` : "N/A"}.
        </p>
        <p>
          Reported market capitalization is approximately{" "}
          <strong>{formatCompactUsd(marketCapUsd)}</strong> with 24-hour volume around{" "}
          <strong>{formatCompactUsd(volume24hUsd)}</strong>. {name} is often grouped with{" "}
          {cat} narratives; always verify fundamentals and your own risk tolerance before
          allocating capital.
        </p>
        <p>
          Block70 aggregates public market data to help you compare tokens and spot trends faster.
          For deeper on-chain context, explore signals, whale flows, and news on this page. Nothing
          here is a recommendation to buy or sell {symbol}.
        </p>
        <p>
          <Link
            href={`/coins/${slug}/insights`}
            className="font-medium text-crypto-blue hover:underline"
          >
            View AI insights for {symbol}
          </Link>{" "}
          — machine-generated commentary from Block70&apos;s insight engine (verify independently).
        </p>
      </div>
    </article>
  );
}
