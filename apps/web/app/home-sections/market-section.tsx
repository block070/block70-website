import dynamic from "next/dynamic";
import { getMarketCoins, getMarketSummary, type MarketCoin } from "@/lib/api";
import { HeroMarketOverview } from "@/components/home/hero-market-overview";
import { MarketStatsBar } from "@/components/home/market-stats-bar";
import { GainersLosers } from "@/components/market/gainers-losers";
import { withTimeout } from "@/lib/with-timeout";

const MarketHeatmap = dynamic(
  () => import("@/components/market/market-heatmap").then((m) => ({ default: m.MarketHeatmap })),
  {
    ssr: true,
    loading: () => (
      <div className="h-64 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] animate-pulse" />
    ),
  },
);

const FETCH_TIMEOUT_MS = 6_000;

export async function MarketSection() {
  let marketCoins: MarketCoin[] = [];
  let marketError: string | null = null;
  let dataAsOf: string | undefined;
  let dataSource: string | undefined;
  let summary: Awaited<ReturnType<typeof getMarketSummary>> | null = null;

  try {
    summary = await withTimeout(getMarketSummary(30), FETCH_TIMEOUT_MS);
    marketCoins = summary.top ?? [];
    dataAsOf = summary.as_of;
    dataSource = summary.source;
  } catch (e) {
    marketError = e instanceof Error ? e.message : "Unknown error";
    try {
      marketCoins = await withTimeout(getMarketCoins({ limit: 30, page: 1 }), FETCH_TIMEOUT_MS);
    } catch (e2) {
      marketError = e2 instanceof Error ? e2.message : marketError;
    }
  }

  const validMarket = marketCoins.filter(
    (c) =>
      typeof c.price === "number" &&
      typeof c.market_cap === "number" &&
      typeof c.volume === "number" &&
      typeof c.change_24h === "number",
  );

  let totalMarketCap: number | undefined;
  let totalVolume24h: number | undefined;
  let btcDominance: number | undefined;
  let ethDominance: number | undefined;

  const g = summary?.global;
  if (g?.total_market_cap_usd != null) {
    totalMarketCap = g.total_market_cap_usd;
    totalVolume24h = g.total_volume_usd ?? undefined;
    btcDominance = g.btc_dominance_pct ?? undefined;
    ethDominance = g.eth_dominance_pct ?? undefined;
  }

  if (totalMarketCap == null) {
    const sumCap = validMarket.reduce((sum, c) => sum + (c.market_cap ?? 0), 0);
    const sumVol = validMarket.reduce((sum, c) => sum + (c.volume ?? 0), 0);
    totalMarketCap = sumCap || undefined;
    totalVolume24h = sumVol || undefined;
    const btc = validMarket.find((c) => (c.symbol || "").toUpperCase() === "BTC");
    const eth = validMarket.find((c) => (c.symbol || "").toUpperCase() === "ETH");
    btcDominance =
      sumCap > 0 && btc?.market_cap ? (btc.market_cap / sumCap) * 100 : undefined;
    ethDominance =
      sumCap > 0 && eth?.market_cap ? (eth.market_cap / sumCap) * 100 : undefined;
  }

  const pricedMajors = validMarket.slice(0, 6).map((c) => ({
    symbol: c.symbol,
    slug: c.slug,
    logoUrl: c.logo_url ?? null,
    price: c.price ?? 0,
    change24h: c.change_24h ?? 0,
  }));
  const gainers = [...validMarket]
    .sort((a, b) => (b.change_24h ?? -Infinity) - (a.change_24h ?? -Infinity))
    .slice(0, 10)
    .map((c) => ({
      symbol: c.symbol,
      name: c.name,
      slug: c.slug,
      logoUrl: c.logo_url ?? null,
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
      slug: c.slug,
      logoUrl: c.logo_url ?? null,
      price: c.price ?? 0,
      change24h: c.change_24h ?? 0,
      volume24h: c.volume ?? 0,
      marketCap: c.market_cap ?? 0,
    }));
  const heatmapCoins = validMarket.slice(0, 30).map((c) => ({
    symbol: c.symbol,
    name: c.name,
    slug: c.slug,
    logoUrl: c.logo_url ?? null,
    price: c.price ?? 0,
    change24h: c.change_24h ?? 0,
    marketCap: c.market_cap ?? 0,
    volume24h: c.volume ?? 0,
  }));

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-1">
        <HeroMarketOverview
          totalMarketCap={totalMarketCap}
          volume24h={totalVolume24h}
          btcDominance={btcDominance}
          ethDominance={ethDominance}
          dataAsOf={dataAsOf}
          dataSource={dataSource}
          topTrendingCoin={
            gainers[0]
              ? {
                  symbol: gainers[0].symbol,
                  slug: gainers[0].slug,
                  change24h: Number(gainers[0].change24h.toFixed(2)),
                  logoUrl: gainers[0].logoUrl ?? null,
                }
              : undefined
          }
        />
        <MarketStatsBar
          prices={pricedMajors}
          topGainer={gainers[0]}
          topLoser={losers[0]}
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
