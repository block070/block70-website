import dynamic from "next/dynamic";
import { getMarketCoins } from "@/lib/api";
import { HeroMarketOverview } from "@/components/home/hero-market-overview";
import { MarketStatsBar } from "@/components/home/market-stats-bar";
import { GainersLosers } from "@/components/market/gainers-losers";
import { withTimeout } from "@/lib/with-timeout";

const MarketHeatmap = dynamic(
  () => import("@/components/market/market-heatmap").then((m) => ({ default: m.MarketHeatmap })),
  { ssr: true, loading: () => <div className="h-64 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" /> }
);

const FETCH_TIMEOUT_MS = 6_000;

export async function MarketSection() {
  let marketCoins: Awaited<ReturnType<typeof getMarketCoins>> = [];
  let marketError: string | null = null;

  try {
    marketCoins = await withTimeout(
      getMarketCoins({ limit: 30, page: 1 }),
      FETCH_TIMEOUT_MS
    );
  } catch (e) {
    marketError = e instanceof Error ? e.message : "Unknown error";
  }

  const validMarket = marketCoins.filter(
    (c) =>
      typeof c.price === "number" &&
      typeof c.market_cap === "number" &&
      typeof c.volume === "number" &&
      typeof c.change_24h === "number",
  );
  const totalMarketCap = validMarket.reduce((sum, c) => sum + (c.market_cap ?? 0), 0);
  const totalVolume24h = validMarket.reduce((sum, c) => sum + (c.volume ?? 0), 0);
  const btc = validMarket.find((c) => (c.symbol || "").toUpperCase() === "BTC");
  const eth = validMarket.find((c) => (c.symbol || "").toUpperCase() === "ETH");
  const btcDominance =
    totalMarketCap > 0 && btc?.market_cap ? (btc.market_cap / totalMarketCap) * 100 : undefined;
  const ethDominance =
    totalMarketCap > 0 && eth?.market_cap ? (eth.market_cap / totalMarketCap) * 100 : undefined;

  const pricedMajors = validMarket.slice(0, 6).map((c) => ({
    symbol: c.symbol,
    price: c.price ?? 0,
    change24h: c.change_24h ?? 0,
  }));
  const gainers = [...validMarket]
    .sort((a, b) => (b.change_24h ?? -Infinity) - (a.change_24h ?? -Infinity))
    .slice(0, 10)
    .map((c) => ({
      symbol: c.symbol,
      name: c.name,
      price: c.price ?? 0,
      change24h: c.change_24h ?? 0,
      volume24h: c.volume ?? 0,
      marketCap: c.market_cap ?? 0,
    }));
  const losers = [...validMarket]
    .sort((a, b) => (a.change_24h ?? Infinity) - (b.change_24h ?? Infinity))
    .slice(0, 10)
    .map((c) => ({
      symbol: c.symbol,
      name: c.name,
      price: c.price ?? 0,
      change24h: c.change_24h ?? 0,
      volume24h: c.volume ?? 0,
      marketCap: c.market_cap ?? 0,
    }));
  const heatmapCoins = validMarket.slice(0, 30).map((c) => ({
    symbol: c.symbol,
    name: c.name,
    slug: c.slug,
    price: c.price ?? 0,
    change24h: c.change_24h ?? 0,
    marketCap: c.market_cap ?? 0,
    volume24h: c.volume ?? 0,
  }));

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-1">
        <HeroMarketOverview
          totalMarketCap={totalMarketCap || undefined}
          volume24h={totalVolume24h || undefined}
          btcDominance={btcDominance}
          ethDominance={ethDominance}
          topTrendingCoin={
            gainers[0]
              ? { symbol: gainers[0].symbol, change24h: Number(gainers[0].change24h.toFixed(2)) }
              : undefined
          }
        />
        <MarketStatsBar
          prices={pricedMajors}
          topGainer={gainers[0]?.symbol}
          topLoser={losers[0]?.symbol}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--b70-text)]">
          Top Gainers & Losers
        </h2>
        <GainersLosers gainers={gainers} losers={losers} />
        {marketError ? (
          <p className="mt-2 text-xs text-[var(--b70-text-muted)]">
            Market data temporarily unavailable.{" "}
            <span className="font-mono">{marketError}</span>
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--b70-text)]">
          Market heatmap
        </h2>
        <MarketHeatmap coins={heatmapCoins} />
      </section>
    </>
  );
}
