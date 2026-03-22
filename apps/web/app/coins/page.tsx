import Link from "next/link";
import { CoinTable } from "@/components/market/coin-table";
import { CoinsPagination } from "@/components/market/coins-pagination";
import { MarketStats } from "@/components/market/market-stats";
import { getMarketCoins, type MarketCoin } from "@/lib/api";
import { COINS } from "@/lib/crypto-mock";
import { getCoinsList, TOTAL_COINS_PAGINATED } from "@/lib/coins";
import { withTimeout } from "@/lib/with-timeout";
import type { Coin } from "@/lib/crypto-mock";

export const revalidate = 60;

export const metadata = {
  title: "Coins · Block70 Crypto Data",
  description:
    "Market data for majors, aligned with the Block70 intelligence system.",
};

const VALID_LIMITS = [10, 25, 50, 100, 200] as const;

function apiCoinsToShape(
  list: Awaited<ReturnType<typeof getCoinsList>>,
  page: number,
  limit: number
): Coin[] {
  const rankOffset = (page - 1) * limit;
  return list.map((item, i) => ({
    id: String(item.coin.id),
    slug: item.coin.slug,
    symbol: item.coin.symbol,
    name: item.coin.name,
    logoUrl: item.coin.logo_url ?? undefined,
    priceUsd: item.coin.price ?? item.latest_market_data?.price ?? 0,
    marketCapUsd: item.coin.market_cap ?? item.latest_market_data?.market_cap ?? 0,
    volume24hUsd: item.coin.volume_24h ?? item.latest_market_data?.volume_24h ?? 0,
    change24hPct: item.latest_market_data?.price_change_24h ?? Number.NaN,
    change7dPct: item.latest_market_data?.price_change_7d ?? Number.NaN,
    rank: rankOffset + i + 1,
    categoryIds: item.coin.category ? [item.coin.category] : [],
    chainIds: item.coin.chain ? [item.coin.chain] : [],
  }));
}

function marketCoinsToShape(
  list: MarketCoin[],
  page: number,
  limit: number
): Coin[] {
  const rankOffset = (page - 1) * limit;
  return list.map((item, i) => ({
    id: item.slug,
    slug: item.slug,
    symbol: item.symbol,
    name: item.name,
    logoUrl: item.logo_url ?? undefined,
    priceUsd: item.price ?? 0,
    marketCapUsd: item.market_cap ?? 0,
    volume24hUsd: item.volume ?? 0,
    change24hPct: item.change_24h ?? Number.NaN,
    change7dPct: item.change_7d ?? Number.NaN,
    rank: rankOffset + i + 1,
    categoryIds: [],
    chainIds: [],
  }));
}

type PageProps = {
  searchParams: Promise<{ page?: string; limit?: string }>;
};

export default async function CoinsPage({ searchParams }: PageProps) {
  const { page: pageParam, limit: limitParam } = await searchParams;
  const parsedLimit = parseInt(limitParam ?? "100", 10) || 100;
  const limit = (VALID_LIMITS as readonly number[]).includes(parsedLimit)
    ? (parsedLimit as (typeof VALID_LIMITS)[number])
    : 100;
  const totalPages = Math.max(1, Math.ceil(TOTAL_COINS_PAGINATED / limit));
  const page = Math.min(
    Math.max(1, parseInt(pageParam ?? "1", 10) || 1),
    totalPages
  );

  const FETCH_TIMEOUT_MS = 10_000;
  let coins: Coin[] = COINS;
  try {
    const list = await withTimeout(getCoinsList({ limit, page }), FETCH_TIMEOUT_MS);
    if (list.length > 0) {
      coins = apiCoinsToShape(list, page, limit);
    } else {
      throw new Error("Coins API returned empty");
    }
  } catch {
    try {
      const chunk = await withTimeout(
        getMarketCoins({ limit: Math.min(limit, 100), page }),
        FETCH_TIMEOUT_MS
      );
      if (chunk.length > 0) {
        coins = marketCoinsToShape(chunk, page, limit);
      }
    } catch {
      // use mock COINS
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Market overview
        </h1>
        <p className="text-sm text-slate-400">
          A CoinGecko-style view, wired into the Block70 intelligence fabric.
          Data from API when available; otherwise mock majors.
        </p>
      </header>
      <MarketStats />
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <p className="text-slate-400">
            Top majors by market cap.
          </p>
        </div>
        <CoinTable coins={coins} />
        <CoinsPagination
          currentPage={page}
          totalPages={totalPages}
          limit={limit}
        />
      </section>
      <p className="text-xs text-slate-400">
        <Link href="/categories" className="text-crypto-blue hover:underline">
          Browse all categories
        </Link>
        {" · "}
        <Link href="/signals" className="text-crypto-blue hover:underline">
          Signals
        </Link>
      </p>
    </div>
  );
}
