import Link from "next/link";
import { notFound } from "next/navigation";

import { CoinChart } from "@/components/coins/coin-chart";
import { CoinDescription } from "@/components/coins/coin-description";
import { CoinIntelligence } from "@/components/coins/coin-intelligence";
import { CoinLinks } from "@/components/coins/coin-links";
import { CoinOpportunities } from "@/components/coins/coin-opportunities";
import { CoinPriceHeader } from "@/components/coins/coin-price-header";
import { CoinStats } from "@/components/coins/coin-stats";
import { SignalCard } from "@/components/signals/signal-card";
import { SentimentPanel } from "@/components/sentiment/sentiment-panel";
import { AISentimentSummary } from "@/components/sentiment/ai-sentiment-summary";
import type { Coin } from "@/lib/crypto-mock";
import { getCoinBySlugOrMock, type CoinInfoDto, type MarketDataPointDto } from "@/lib/coins";
import { getNewsForCoin, getSignalsForToken } from "@/lib/api";
import { getSentiment } from "@/lib/sentiment-api";

function coinToHeaderShape(coin: CoinInfoDto, latestMd?: MarketDataPointDto | null): Coin {
  return {
    id: String(coin.id),
    slug: coin.slug,
    symbol: coin.symbol,
    name: coin.name,
    priceUsd: coin.price ?? latestMd?.price ?? 0,
    marketCapUsd: coin.market_cap ?? latestMd?.market_cap ?? 0,
    volume24hUsd: coin.volume_24h ?? latestMd?.volume_24h ?? 0,
    change24hPct:
      latestMd?.price_change_24h ??
      Number.NaN,
    change7dPct:
      latestMd?.price_change_7d ??
      Number.NaN,
    rank: 0,
    categoryIds: coin.category ? [coin.category] : [],
    chainIds: coin.chain ? [coin.chain] : [],
  };
}

type Params = {
  slug: string;
};

export async function generateMetadata({ params }: { params: Params }) {
  try {
    const data = await getCoinBySlugOrMock(params.slug);
    const coin = data.coin;
    return {
      title: `${coin.name} (${coin.symbol}) · Block70 Crypto Data`,
      description: `Live Block70 intelligence surface for ${coin.name}, including price, narratives, news, and Block70 signals.`,
    };
  } catch {
    return {};
  }
}

export default async function CoinDetailPage({ params }: { params: Params }) {
  let data;
  try {
    data = await getCoinBySlugOrMock(params.slug);
  } catch {
    notFound();
  }
  if (!data) notFound();

  const { coin, market_data: series, narratives, news: fallbackNews } = data;

  const prices = series.map((p) => ({
    timestamp: p.timestamp,
    priceUsd: p.price,
  }));

  const coinForHeader: Coin = coinToHeaderShape(coin, series[0]);
  const symbol = coin.symbol.toUpperCase();

  let signals: Awaited<ReturnType<typeof getSignalsForToken>> = [];
  let coinNews: Awaited<ReturnType<typeof getNewsForCoin>> = [];
  let sentiment: Awaited<ReturnType<typeof getSentiment>> | null = null;
  try {
    signals = await getSignalsForToken(symbol, { limit: 5 });
  } catch {
    // ignore
  }
  try {
    coinNews = await getNewsForCoin(symbol, { limit: 10 });
  } catch {
    coinNews = [];
  }
  try {
    sentiment = await getSentiment(symbol);
  } catch {
    // ignore
  }

  const renderedNews = coinNews.length > 0 ? coinNews : fallbackNews;

  return (
    <div className="space-y-6">
      <CoinPriceHeader coin={coinForHeader} />

      <section className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <CoinChart points={prices} />
        <CoinStats coin={coinForHeader} />
      </section>

      <section className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <CoinOpportunities symbol={symbol} opportunities={[]} />

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                Latest signals
              </p>
              <Link
                href={`/signals/${encodeURIComponent(symbol)}`}
                className="text-[11px] font-medium text-blue-400 hover:text-blue-300"
              >
                View all
              </Link>
            </div>
            {signals.length ? (
              <div className="space-y-2">
                {signals.slice(0, 3).map((sig) => (
                  <SignalCard key={sig.id} signal={sig} />
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                No signals yet for {symbol}.
              </p>
            )}
          </section>

          <Link
            href={`/coins/${data.coin.slug}/community`}
            className="block rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs font-medium text-blue-400 hover:bg-slate-800"
          >
            View community discussion →
          </Link>

          <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Whale trades
            </p>
            <p className="text-[11px] text-slate-500">
              Large trades for {symbol} from the wallet tracker appear in{" "}
              <Link href="/wallets/smart-money" className="text-blue-400 hover:underline">
                Smart money
              </Link>
              .
            </p>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Narratives
            </p>
            {narratives.length ? (
              <ul className="space-y-1.5">
                {narratives.map((narrative) => (
                  <li
                    key={narrative.name}
                    className="flex items-start justify-between gap-2"
                  >
                    <div>
                      <p className="text-[11px] font-medium text-slate-100">
                        {narrative.name}
                      </p>
                      {narrative.description && (
                        <p className="text-[11px] text-slate-400">
                          {narrative.description}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-300">
                      {Math.round(narrative.confidence_score * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-500">
                No narratives detected yet for this coin.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <CoinDescription coin={coinForHeader} />
          <SentimentPanel tokenSymbol={symbol} initialSummary={sentiment} />
          <AISentimentSummary tokenSymbol={symbol} />
          <CoinLinks
            websiteUrl={coin.website ?? undefined}
            docsUrl={undefined}
            explorerUrl={undefined}
            twitterHandle={coin.twitter ?? undefined}
            telegramUrl={coin.discord ?? undefined}
          />
          <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Related news
            </p>
            {renderedNews.length ? (
              <ul className="space-y-1.5">
                {renderedNews.map((article) => (
                  <li key={article.url}>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-medium text-slate-100 hover:text-emerald-300"
                    >
                      {article.title}
                    </a>
                    <p className="text-[11px] text-slate-500">
                      {article.source}
                      {"rank_explanation" in article && article.rank_explanation
                        ? " · Ranked for coin relevance"
                        : ""}
                      {" "}
                      {article.published_at
                        ? `· ${new Date(
                            article.published_at,
                          ).toLocaleString()}`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-500">
                No recent news articles found.
              </p>
            )}
          </section>
        </div>
      </section>

      <CoinIntelligence symbol={symbol} />
    </div>
  );
}

