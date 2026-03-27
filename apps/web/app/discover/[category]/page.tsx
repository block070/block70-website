import Link from "next/link";
import { getCoinsList } from "@/lib/coins";
import { withTimeout } from "@/lib/with-timeout";
import { CoinTable } from "@/components/market/coin-table";
import { CategoryMarketOverview } from "@/components/discover/category-market-overview";
import { getCategoryDescription } from "@/lib/category-descriptions";
import type { Coin } from "@/lib/crypto-mock";
import { DISCOVER_SLUG_TO_TITLE } from "@/lib/discover-category-map";

const SLUG_TO_TITLE = DISCOVER_SLUG_TO_TITLE;

/** Convert URL slug to category query for API. */
function slugToCategoryQuery(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getCategoryTitle(slug: string): string {
  return SLUG_TO_TITLE[slug] ?? slugToCategoryQuery(slug);
}

function itemsToCoins(
  items: Awaited<ReturnType<typeof getCoinsList>>,
  rankStart: number
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

type PageProps = {
  params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { category } = await params;
  const title = getCategoryTitle(category);
  return {
    title: `${title} · Block70 Discover`,
    description: `Explore ${title} tokens. Market cap, 24h volume, top gainers and losers.`,
    openGraph: {
      title: `${title} · Block70`,
      description: `Explore ${title} tokens.`,
    },
  };
}

export default async function DiscoverCategoryPage({ params }: PageProps) {
  const { category } = await params;
  const title = getCategoryTitle(category);

  let items: Awaited<ReturnType<typeof getCoinsList>> = [];

  try {
    items = await withTimeout(
      getCoinsList({ category_slug: category, limit: 100, page: 1 }),
      6_000
    );
  } catch {
    // Use empty state
  }

  const coins = itemsToCoins(items, 0);
  const marketCap = coins.reduce((s, c) => s + (c.marketCapUsd || 0), 0) || undefined;
  const volume24h = coins.reduce((s, c) => s + (c.volume24hUsd || 0), 0) || undefined;

  const withChange = coins.filter((c) => typeof c.change24hPct === "number" && Number.isFinite(c.change24hPct));
  const sortedByGain = [...withChange].sort((a, b) => (b.change24hPct ?? -Infinity) - (a.change24hPct ?? -Infinity));
  const sortedByLoss = [...withChange].sort((a, b) => (a.change24hPct ?? Infinity) - (b.change24hPct ?? Infinity));
  const topGainer = sortedByGain[0];
  const topLoser = sortedByLoss[0];

  const description = getCategoryDescription(category, title);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
          Coins in the {title} category. Explore market data, signals, and opportunities.
        </p>
        <p className="mt-2 text-xs text-[var(--b70-text-muted)]">
          <Link href={`/categories/${encodeURIComponent(category)}`} className="text-crypto-blue hover:underline">
            Open sector intelligence view
          </Link>{" "}
          for dominance, snapshot KPIs, and flow context (same slug when the category exists in snapshots).
        </p>
      </section>

      <CategoryMarketOverview
        categoryName={title}
        marketCap={marketCap}
        volume24h={volume24h}
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
        <h2 className="text-sm font-semibold text-[var(--b70-text)]">About {title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--b70-text-muted)]">
          {description}
        </p>
      </section>

      {items.length === 0 ? (
        <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-8 text-center text-sm text-[var(--b70-text-muted)] shadow-sm">
          No tokens in this category yet. Data is sourced from live market APIs and the coin database.
        </section>
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--b70-text)]">Coins</h2>
          <CoinTable coins={coins} />
        </section>
      )}

      <p className="text-xs text-[var(--b70-text-muted)]">
        <Link href="/categories" className="text-crypto-blue hover:underline">
          All categories
        </Link>
        {" · "}
        <Link href="/signals" className="text-crypto-blue hover:underline">
          View all signals
        </Link>
        {" · "}
        <Link href="/opportunities" className="text-crypto-blue hover:underline">
          Opportunities
        </Link>
      </p>
    </div>
  );
}
