import Link from "next/link";
import dynamic from "next/dynamic";

const PriceChart = dynamic(
  () =>
    import("@/components/charts/price-chart").then((m) => ({ default: m.PriceChart })),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[420px] w-full max-w-full animate-pulse rounded-xl border border-slate-800 bg-slate-900/50"
        aria-hidden
      />
    ),
  }
);
import { CoinDescription } from "@/components/coins/coin-description";
import { CoinFaqJsonLd } from "@/components/coins/coin-faq-json-ld";
import { CoinHeroConversion } from "@/components/coins/coin-hero-conversion";
import { CoinIntelligence } from "@/components/coins/coin-intelligence";
import { CoinInvestmentAnalysis } from "@/components/coins/coin-investment-analysis";
import { CoinLinks } from "@/components/coins/coin-links";
import { CoinOpportunities } from "@/components/coins/coin-opportunities";
import { CoinWhaleActivity } from "@/components/coins/coin-whale-activity";
import { RelatedCoins } from "@/components/coins/related-coins";
import { RoiCalculator } from "@/components/coins/roi-calculator";
import { SignalCard } from "@/components/signals/signal-card";
import { SentimentPanel } from "@/components/sentiment/sentiment-panel";
import { AISentimentSummary } from "@/components/sentiment/ai-sentiment-summary";
import type { Coin } from "@/lib/crypto-mock";
import { investmentLabelFromScore } from "@/lib/coin-signal-label";
import {
  getCoinBySlugOrMock,
  getCoinsList,
  getStubCoinDetail,
  pickLatestMarketPoint,
  type CoinInfoDto,
  type MarketDataPointDto,
} from "@/lib/coins";
import { computeBlock70Score } from "@/lib/coins-scanner";
import { getNewsForCoin, getSignalsForToken } from "@/lib/api";
import { getSentiment } from "@/lib/sentiment-api";
import { withTimeout } from "@/lib/with-timeout";

function coinToHeaderShape(
  coin: CoinInfoDto,
  latestMd?: MarketDataPointDto | null,
  series?: MarketDataPointDto[]
): Coin {
  const md =
    latestMd ??
    (series?.length ? pickLatestMarketPoint(series) : undefined) ??
    undefined;
  const priceFromCoin =
    typeof coin.price === "number" && Number.isFinite(coin.price) && coin.price > 0
      ? coin.price
      : undefined;
  const priceFromMd =
    md && typeof md.price === "number" && Number.isFinite(md.price) && md.price > 0
      ? md.price
      : undefined;
  return {
    id: String(coin.id),
    slug: coin.slug,
    symbol: coin.symbol,
    name: coin.name,
    priceUsd: priceFromCoin ?? priceFromMd ?? 0,
    marketCapUsd: (coin.market_cap ?? md?.market_cap) ?? 0,
    volume24hUsd: (coin.volume_24h ?? md?.volume_24h) ?? 0,
    change24hPct: md?.price_change_24h ?? Number.NaN,
    change7dPct: md?.price_change_7d ?? Number.NaN,
    rank: coin.market_cap_rank ?? 0,
    categoryIds: coin.category ? [coin.category] : [],
    chainIds: coin.chain ? [coin.chain] : [],
    logoUrl: coin.logo_url ?? undefined,
    categorySlug: coin.category_slug ?? null,
    categoryLabel: coin.category ?? null,
  };
}

type Params = {
  slug: string;
};

export async function generateMetadata({ params }: { params: Params }) {
  try {
    const data = await getCoinBySlugOrMock(params.slug);
    const coin = data.coin;
    const sym = coin.symbol.toUpperCase();
    return {
      title: `${coin.name} (${sym}) Price, Score & Chart · Block70`,
      description: `Live ${coin.name} (${sym}) USD price, Block70 score, interactive chart, ROI calculator, and market context. Not financial advice.`,
      openGraph: {
        title: `${coin.name} (${sym}) · Block70`,
        description: `Price, Block70 score, and tools for ${coin.name} (${sym}).`,
      },
    };
  } catch {
    return {};
  }
}

/** Allow upstream retries in getCoinBySlugOrMock without cutting off early */
const COIN_FETCH_TIMEOUT_MS = 36_000;

export default async function CoinDetailPage({ params }: { params: Params }) {
  const slug = params.slug;
  let data;
  try {
    data = await withTimeout(getCoinBySlugOrMock(slug), COIN_FETCH_TIMEOUT_MS);
  } catch {
    data = getStubCoinDetail(slug);
  }
  if (!data) data = getStubCoinDetail(slug);

  const { coin, market_data: series, narratives, news: fallbackNews } = data;

  const coinForHeader: Coin = coinToHeaderShape(coin, series[0], series);
  const symbol = coin.symbol.toUpperCase();
  const block70Score = computeBlock70Score(coinForHeader);
  const investmentLabel = investmentLabelFromScore(block70Score);

  const FETCH_TIMEOUT_MS = 5_000;
  const [signalsRes, newsRes, sentimentRes, relatedRes] = await Promise.allSettled([
    withTimeout(getSignalsForToken(symbol, { limit: 5 }), FETCH_TIMEOUT_MS, []),
    withTimeout(getNewsForCoin(symbol, { limit: 10 }), FETCH_TIMEOUT_MS, []),
    withTimeout(getSentiment(symbol), FETCH_TIMEOUT_MS).catch(() => null),
    withTimeout(getCoinsList({ limit: 16, page: 1 }), FETCH_TIMEOUT_MS, []),
  ]);
  const signals = signalsRes.status === "fulfilled" ? signalsRes.value : [];
  const coinNews = newsRes.status === "fulfilled" ? newsRes.value : [];
  const sentiment = sentimentRes.status === "fulfilled" ? sentimentRes.value : null;
  const relatedCoins = relatedRes.status === "fulfilled" ? relatedRes.value : [];

  const renderedNews = coinNews.length > 0 ? coinNews : fallbackNews;

  return (
    <div className="space-y-6">
      <CoinFaqJsonLd name={coin.name} symbol={symbol} slug={coin.slug} />

      <CoinHeroConversion
        coin={coinForHeader}
        block70Score={block70Score}
        investmentLabel={investmentLabel}
      />

      <PriceChart coin={coin.slug} symbol={symbol} height={400} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">

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
                        : ""}{" "}
                      {article.published_at
                        ? `· ${new Date(article.published_at).toLocaleString()}`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-500">No recent news articles found.</p>
            )}
          </section>

          <CoinInvestmentAnalysis
            name={coin.name}
            symbol={symbol}
            slug={coin.slug}
            category={coin.category}
            priceUsd={coinForHeader.priceUsd}
            marketCapUsd={coinForHeader.marketCapUsd}
            volume24hUsd={coinForHeader.volume24hUsd}
            change24hPct={coinForHeader.change24hPct}
            change7dPct={coinForHeader.change7dPct}
            block70Score={block70Score}
            investmentLabel={investmentLabel}
          />

          <CoinWhaleActivity name={coin.name} symbol={symbol} />
        </div>

        <div className="space-y-4">
          <RoiCalculator symbol={symbol} currentPriceUsd={coinForHeader.priceUsd} />
          <CoinDescription coin={coinForHeader} description={coin.description} />
          <RelatedCoins items={relatedCoins} currentSlug={coin.slug} />
        </div>
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
              <p className="text-[11px] text-slate-500">No signals yet for {symbol}.</p>
            )}
          </section>

          <Link
            href={`/coins/${data.coin.slug}/community`}
            className="block rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs font-medium text-blue-400 hover:bg-slate-800"
          >
            View community discussion →
          </Link>

          <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Narratives</p>
            {narratives.length ? (
              <ul className="space-y-1.5">
                {narratives.map((narrative) => (
                  <li
                    key={narrative.name}
                    className="flex items-start justify-between gap-2"
                  >
                    <div>
                      <p className="text-[11px] font-medium text-slate-100">{narrative.name}</p>
                      {narrative.description && (
                        <p className="text-[11px] text-slate-400">{narrative.description}</p>
                      )}
                    </div>
                    <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-300">
                      {Math.round(narrative.confidence_score * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-500">No narratives detected yet for this coin.</p>
            )}
          </section>
        </div>

        <div className="space-y-4">
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
