import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryProxyTrendChart } from "@/components/categories/category-proxy-trend-chart";
import { CategoryMarketOverview } from "@/components/discover/category-market-overview";
import { CoinTable } from "@/components/market/coin-table";
import { dominanceForSingleSector, mapCategoryDirectoryToEnriched } from "@/lib/categories-enrichment";
import { getCategoryDescription } from "@/lib/category-descriptions";
import { getCoinsList } from "@/lib/coins";
import type { Coin } from "@/lib/crypto-mock";
import { getCategoryDirectoryEntry, getMarketSummary } from "@/lib/api";
import { withTimeout } from "@/lib/with-timeout";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function itemsToCoins(
  items: Awaited<ReturnType<typeof getCoinsList>>,
  rankStart: number,
): Coin[] {
  return items.map((item, i) => ({
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
    rank: rankStart + i + 1,
    categoryIds: item.coin.category ? [item.coin.category] : [],
    chainIds: item.coin.chain ? [item.coin.chain] : [],
  }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const entry = await getCategoryDirectoryEntry(slug);
  const name = entry?.name?.trim() || decodeURIComponent(slug);
  return {
    title: `${name} · Sector intelligence · Block70`,
    description: `Sector snapshot: market cap, 24h momentum, dominance, constituents, and flow context for ${name}.`,
    openGraph: {
      title: `${name} · Block70`,
      description: `Sector intelligence for ${name}.`,
    },
  };
}

export default async function CategoryDetailPage({ params }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);

  const entry = await getCategoryDirectoryEntry(slug);
  if (!entry) notFound();

  let globalMcapUsd: number | null = null;
  try {
    const summary = await withTimeout(getMarketSummary(1), 12_000);
    const g = summary.global?.total_market_cap_usd;
    if (typeof g === "number" && Number.isFinite(g) && g > 0) globalMcapUsd = g;
  } catch {
    // Page-relative dominance in applyDominanceToCategories
  }

  const base = mapCategoryDirectoryToEnriched(entry);
  const { dominancePct, dominanceBasis } = dominanceForSingleSector(base.market_cap ?? 0, globalMcapUsd);
  const sector = { ...base, dominancePct, dominanceBasis };

  let items: Awaited<ReturnType<typeof getCoinsList>> = [];
  try {
    items = await withTimeout(getCoinsList({ category_slug: slug, limit: 100, page: 1 }), 8_000);
  } catch {
    // empty table
  }

  const coins = itemsToCoins(items, 0);
  const withChange = coins.filter((c) => typeof c.change24hPct === "number" && Number.isFinite(c.change24hPct));
  const sortedByGain = [...withChange].sort((a, b) => (b.change24hPct ?? -Infinity) - (a.change24hPct ?? -Infinity));
  const sortedByLoss = [...withChange].sort((a, b) => (a.change24hPct ?? Infinity) - (b.change24hPct ?? Infinity));
  const topGainer = sortedByGain[0];
  const topLoser = sortedByLoss[0];

  const narrative = getCategoryDescription(sector.id, sector.name);
  const snapshotBlurb =
    typeof sector.content === "string" && sector.content.trim().length > 0
      ? sector.content.trim().slice(0, 280)
      : null;

  const top = sector.top3[0];
  const proxySymbol = top?.symbol?.trim() || "BTC";
  const proxySlug = top?.slug?.trim() || "bitcoin";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <nav className="text-xs text-[var(--b70-text-muted)]">
        <Link href="/categories" className="text-crypto-blue hover:underline">
          Categories
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-[var(--b70-text)]">{sector.name}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">{sector.name}</h1>
        <p className="mt-1 font-mono text-[11px] text-[var(--b70-text-muted)]">{sector.id}</p>
        <p className="mt-2 text-sm text-[var(--b70-text-muted)]">
          Snapshot-backed sector view: KPIs from category aggregates, live coin list from the same slug, and a
          proxy chart from the top scored constituent.
        </p>
      </header>

      <CategoryMarketOverview
        categoryName={sector.name}
        marketCap={sector.market_cap}
        volume24h={sector.volume_24h}
        marketCapChange24hPct={sector.market_cap_change_24h}
        dominancePct={sector.dominancePct}
        dominanceHint={
          sector.dominanceBasis === "global"
            ? "Share of total crypto market cap (market summary)."
            : "Global market cap total unavailable — dominance not shown."
        }
        coinCount={sector.coinCount}
        topGainer={
          topGainer
            ? {
                symbol: topGainer.symbol,
                slug: topGainer.slug,
                change24h: topGainer.change24hPct ?? 0,
              }
            : undefined
        }
        topLoser={
          topLoser
            ? {
                symbol: topLoser.symbol,
                slug: topLoser.slug,
                change24h: topLoser.change24hPct ?? 0,
              }
            : undefined
        }
      />

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--b70-text)]">Narrative</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--b70-text-muted)]">{narrative}</p>
        {snapshotBlurb && (
          <p className="mt-3 text-sm leading-relaxed text-[var(--b70-text-muted)]">{snapshotBlurb}</p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-[var(--b70-text)]">7-day price (proxy)</h2>
        <CategoryProxyTrendChart symbol={proxySymbol} slug={proxySlug} label={top?.name ?? proxySymbol} />
      </section>

      {items.length === 0 ? (
        <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-8 text-center text-sm text-[var(--b70-text-muted)] shadow-sm">
          No coins returned for this slug yet. Coverage grows as category links are backfilled; try Discover for a
          wider legacy mapping.
        </section>
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--b70-text)]">Coins in sector</h2>
          <CoinTable coins={coins} />
        </section>
      )}

      <p className="text-xs text-[var(--b70-text-muted)]">
        Also available:{" "}
        <Link href={`/discover/${encodeURIComponent(slug)}`} className="text-crypto-blue hover:underline">
          Discover / {slug}
        </Link>
        {" · "}
        <Link href="/signals" className="text-crypto-blue hover:underline">
          Signals
        </Link>
      </p>
    </div>
  );
}
