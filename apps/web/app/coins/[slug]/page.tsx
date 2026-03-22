import Link from "next/link";

import { CoinPriceChart } from "@/components/coins/coin-price-chart";
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
import { getCoinBySlugOrMock, getStubCoinDetail, type CoinInfoDto, type MarketDataPointDto } from "@/lib/coins";
import { getNewsForCoin, getSignalsForToken } from "@/lib/api";
import { getSentiment } from "@/lib/sentiment-api";
import { withTimeout } from "@/lib/with-timeout";

function coinToHeaderShape(coin: CoinInfoDto, latestMd?: MarketDataPointDto | null): Coin {
  return {
    id: String(coin.id),
    slug: coin.slug,
    symbol: coin.symbol,
    name: coin.name,
    priceUsd: coin.price ?? latestMd?.price ?? 0,
    marketCapUsd: coin.market_cap ?? latestMd?.market_cap ?? 0,
    volume24hUsd: coin.volume_24h ?? latestMd?.volume_24h ?? 0,
    change24hPct: latestMd?.price_change_24h ?? Number.NaN,
    change7dPct: latestMd?.price_change_7d ?? Number.NaN,
    rank: coin.market_cap_rank ?? 0,
    categoryIds: coin.category ? [coin.category] : [],
    chainIds: coin.chain ? [coin.chain] : [],
    logoUrl: coin.logo_url ?? undefined,
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

const COIN_FETCH_TIMEOUT_MS = 8_000;

export default async function CoinDetailPage({ params }: { params: Params }) {
  const slug = params.slug;
  let data;
  try {
    data = await withTimeout(
      getCoinBySlugOrMock(slug),
      COIN_FETCH_TIMEOUT_MS
    );
  } catch {
    data = getStubCoinDetail(slug);
  }
  if (!data) data = getStubCoinDetail(slug);

  const { coin, market_data: series, narratives, news: fallbackNews } = data;

  const coinForHeader: Coin = coinToHeaderShape(coin, series[0]);
  const symbol = coin.symbol.toUpperCase();

  const FETCH_TIMEOUT_MS = 5_000;
  const [signalsRes, newsRes, sentimentRes] = await Promise.allSettled([
    withTimeout(getSignalsForToken(symbol, { limit: 5 }), FETCH_TIMEOUT_MS, []),
    withTimeout(getNewsForCoin(symbol, { limit: 10 }), FETCH_TIMEOUT_MS, []),
    withTimeout(getSentiment(symbol), FETCH_TIMEOUT_MS).catch(() => null),
  ]);
  const signals = signalsRes.status === "fulfilled" ? signalsRes.value : [];
  const coinNews = newsRes.status === "fulfilled" ? newsRes.value : [];
  const sentiment = sentimentRes.status === "fulfilled" ? sentimentRes.value : null;

  const renderedNews = coinNews.length > 0 ? coinNews : fallbackNews;

  return (
    <div className="space-y-6">
      <CoinPriceHeader coin={coinForHeader} />

      <section className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <CoinPriceChart slug={coin.slug} />
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
          <CoinDescription coin={coinForHeader} description={coin.description} />
          <SentimentPanel tokenSymbol={symbol} initialSummary={sentiment} />
          <AISentimentSummary tokenSymbol={symbol} />
          <CoinLinks
            websiteUrl={coin.website ?? undefined}
            whitepaperUrl={coin.whitepaper_url ?? undefined}
            explorerUrl={coin.explorer_url ?? undefined}
            twitterHandle={coin.twitter ?? undefined}
            telegramUrl={coin.telegram ?? undefined}
          />
        </div>
      </section>

      <CoinIntelligence symbol={symbol} />
    </div>
  );
}

