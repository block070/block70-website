import { CoinTable } from "@/components/market/coin-table";
import { MarketStats } from "@/components/market/market-stats";
import { COINS } from "@/lib/crypto-mock";
import { getCoinsList } from "@/lib/coins";

export const metadata = {
  title: "Coins · Block70 Crypto Data",
  description:
    "Market data for majors, aligned with the Block70 intelligence system.",
};

function apiCoinsToMockShape(
  list: Awaited<ReturnType<typeof getCoinsList>>
): typeof COINS {
  return list.map((item, i) => ({
    id: String(item.coin.id),
    slug: item.coin.slug,
    symbol: item.coin.symbol,
    name: item.coin.name,
    priceUsd: item.coin.price ?? item.latest_market_data?.price ?? 0,
    marketCapUsd: item.coin.market_cap ?? item.latest_market_data?.market_cap ?? 0,
    volume24hUsd: item.coin.volume_24h ?? item.latest_market_data?.volume_24h ?? 0,
    change24hPct: item.latest_market_data?.price_change_24h ?? 0,
    change7dPct: item.latest_market_data?.price_change_7d ?? 0,
    rank: i + 1,
    categoryIds: item.coin.category ? [item.coin.category] : [],
    chainIds: item.coin.chain ? [item.coin.chain] : [],
  }));
}

export default async function CoinsPage() {
  let coins = COINS;
  try {
    const list = await getCoinsList({ limit: 100 });
    if (list.length > 0) {
      coins = apiCoinsToMockShape(list);
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
      </section>
    </div>
  );
}

