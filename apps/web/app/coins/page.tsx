import { CoinTable } from "@/components/market/coin-table";
import { CoinsPagination } from "@/components/market/coins-pagination";
import { MarketStats } from "@/components/market/market-stats";
import { COINS } from "@/lib/crypto-mock";
import { getCoinsList, TOTAL_COINS_PAGINATED } from "@/lib/coins";

export const metadata = {
  title: "Coins · Block70 Crypto Data",
  description:
    "Market data for majors, aligned with the Block70 intelligence system.",
};

const VALID_LIMITS = [10, 25, 50, 100, 200] as const;

function apiCoinsToMockShape(
  list: Awaited<ReturnType<typeof getCoinsList>>,
  page: number,
  limit: number
): typeof COINS {
  const rankOffset = (page - 1) * limit;
  return list.map((item, i) => ({
    id: String(item.coin.id),
    slug: item.coin.slug,
    symbol: item.coin.symbol,
    name: item.coin.name,
    priceUsd: item.coin.price ?? item.latest_market_data?.price ?? 0,
    marketCapUsd: item.coin.market_cap ?? item.latest_market_data?.market_cap ?? 0,
    volume24hUsd: item.coin.volume_24h ?? item.latest_market_data?.volume_24h ?? 0,
    change24hPct:
      item.latest_market_data?.price_change_24h ??
      Number.NaN,
    change7dPct:
      item.latest_market_data?.price_change_7d ??
      Number.NaN,
    rank: rankOffset + i + 1,
    categoryIds: item.coin.category ? [item.coin.category] : [],
    chainIds: item.coin.chain ? [item.coin.chain] : [],
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

  let coins = COINS;
  try {
    const list = await getCoinsList({ limit, page });
    if (list.length > 0) {
      coins = apiCoinsToMockShape(list, page, limit);
    }
  } catch {
    // use mock COINS
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
    </div>
  );
}

