import Link from "next/link";
import { Suspense } from "react";
import {
  getTrendingMarketCoins,
  getMarketCoins,
  type TrendingMarketCoin,
  type MarketCoin,
} from "@/lib/api";
import { CoinTable } from "@/components/market/coin-table";
import { ChainContextBanner } from "@/components/trending/chain-context-banner";
import { TRENDING_COINS } from "@/lib/crypto-mock";
import type { Coin } from "@/lib/crypto-mock";
import { withTimeout } from "@/lib/with-timeout";

export const revalidate = 60;

export const metadata = {
  title: "Trending · Block70 Crypto Data",
  description:
    "Discover the cryptocurrencies gaining the most attention right now. Block70's Trending page surfaces fast-moving coins based on market activity, volume spikes, and momentum signals—giving you a clear view of where interest is building so you can spot opportunities before they fully develop.",
};

function mockToCoins(): Coin[] {
  return TRENDING_COINS.map((c, i) => ({
    id: c.slug,
    slug: c.slug,
    symbol: c.symbol,
    name: c.name,
    priceUsd: c.priceUsd,
    marketCapUsd: c.marketCapUsd,
    volume24hUsd: c.volume24hUsd,
    change24hPct: c.change24hPct,
    change7dPct: c.change7dPct,
    rank: i + 1,
    categoryIds: c.categoryIds,
    chainIds: c.chainIds,
    logoUrl: c.logoUrl,
  }));
}

function trendingToCoins(
  trending: TrendingMarketCoin[],
  marketBySlug: Map<string, MarketCoin>
): Coin[] {
  const btcPriceUsd =
    marketBySlug.get("bitcoin")?.price ??
    marketBySlug.get("btc")?.price ??
    0;

  return trending.map((t, i) => {
    const slug = t.coingecko_id ?? t.symbol.toLowerCase();
    const market = marketBySlug.get(slug);

    if (market) {
      return {
        id: market.slug,
        slug: market.slug,
        symbol: market.symbol,
        name: market.name,
        priceUsd: market.price ?? 0,
        marketCapUsd: market.market_cap ?? 0,
        volume24hUsd: market.volume ?? 0,
        change24hPct: market.change_24h ?? Number.NaN,
        change7dPct: market.change_7d ?? Number.NaN,
        rank: t.rank ?? i + 1,
        categoryIds: [],
        chainIds: [],
        logoUrl: market.logo_url ?? t.image,
      };
    }

    const priceUsd =
      t.price != null && btcPriceUsd > 0 ? t.price * btcPriceUsd : 0;

    return {
      id: slug,
      slug,
      symbol: t.symbol,
      name: t.name,
      priceUsd,
      marketCapUsd: 0,
      volume24hUsd: 0,
      change24hPct: Number.NaN,
      change7dPct: Number.NaN,
      rank: t.rank ?? i + 1,
      categoryIds: [],
      chainIds: [],
      logoUrl: t.image ?? undefined,
    };
  });
}

export default async function TrendingPage() {
  let coins: Coin[] = [];
  let isFallback = false;
  const FETCH_TIMEOUT_MS = 8_000;

  try {
    const [trending, marketChunk] = await Promise.all([
      withTimeout(getTrendingMarketCoins(30), FETCH_TIMEOUT_MS),
      withTimeout(getMarketCoins({ limit: 100, page: 1 }), FETCH_TIMEOUT_MS),
    ]);

    if (trending.length > 0) {
      const marketBySlug = new Map(
        marketChunk.map((m) => [m.slug?.toLowerCase() ?? "", m])
      );
      coins = trendingToCoins(trending, marketBySlug);
    } else {
      throw new Error("Trending API returned empty");
    }
  } catch {
    coins = mockToCoins();
    isFallback = true;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Trending</h1>
        <p className="text-sm text-slate-400">
          Discover the cryptocurrencies gaining the most attention right now.
          Block70&apos;s Trending page surfaces fast-moving coins based on market
          activity, volume spikes, and momentum signals—giving you a clear view
          of where interest is building so you can spot opportunities before
          they fully develop.
        </p>
      </header>
      <Suspense fallback={null}>
        <ChainContextBanner />
      </Suspense>
      {isFallback && (
        <div className="rounded-xl border border-amber-900/60 bg-amber-950/40 p-3 text-xs text-amber-200">
          Showing sample data — API temporarily unavailable.{" "}
          <a href="/trending" className="underline hover:no-underline">
            Retry
          </a>
        </div>
      )}
      {coins.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400">
          No trending data from CoinGecko yet. Try refreshing in a few seconds.
        </div>
      ) : (
        <CoinTable coins={coins} />
      )}
      <p className="text-xs text-slate-400">
        <Link href="/coins" className="text-crypto-blue hover:underline">
          Browse all coins
        </Link>
        {" · "}
        <Link href="/categories" className="text-crypto-blue hover:underline">
          Categories
        </Link>
      </p>
    </div>
  );
}
