import Link from "next/link";
import { getCoinsList } from "@/lib/coins";
import { getMarketCategories } from "@/lib/api";
import { CoinTable } from "@/components/market/coin-table";
import { CategoryMarketOverview } from "@/components/discover/category-market-overview";
import { CATEGORY_DESCRIPTIONS } from "@/lib/category-descriptions";
import type { Coin } from "@/lib/crypto-mock";

/** Slug -> human title for display. Covers common CoinGecko category ids. */
const SLUG_TO_TITLE: Record<string, string> = {
  "ai-tokens": "AI Tokens",
  "artificial-intelligence": "Artificial Intelligence",
  "artificial-intelligence-ai": "Artificial Intelligence (AI)",
  "depin-tokens": "DePIN Tokens",
  depin: "DePIN",
  "gaming-tokens": "Gaming Tokens",
  gaming: "Gaming",
  "layer2-tokens": "Layer 2 Tokens",
  "layer-2": "Layer 2",
  "layer-1": "Layer 1",
  defi: "DeFi",
  "decentralized-finance-defi": "Decentralized Finance (DeFi)",
  "decentralized-exchange-dex": "Decentralized Exchange (DEX)",
  meme: "Meme",
  "smart-contract-platform": "Smart Contract Platform",
  "proof-of-work": "Proof of Work",
  "proof-of-work-pow": "Proof of Work (PoW)",
  "proof-of-stake": "Proof of Stake",
  "proof-of-stake-pos": "Proof of Stake (PoS)",
  stablecoins: "Stablecoins",
  infrastructure: "Infrastructure",
  "solana-ecosystem": "Solana Ecosystem",
  "ethereum-ecosystem": "Ethereum Ecosystem",
};

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
  let categoryStats: { market_cap?: number; volume_24h?: number } | null = null;

  try {
    [items, categoryStats] = await Promise.all([
      getCoinsList({ category_slug: category, limit: 200, page: 1 }),
      (async () => {
        const { items: cats } = await getMarketCategories({ limit: 300, page: 1 });
        const norm = (s: string) => (s || "").toLowerCase().replace(/[\s()]/g, "-").replace(/-+/g, "-");
        const match = cats.find(
          (c) => c.id === category || norm(c.id ?? "") === norm(category)
        );
        return match ? { market_cap: match.market_cap, volume_24h: match.volume_24h } : null;
      })(),
    ]);
  } catch {
    // Use empty state
  }

  const coins = itemsToCoins(items, 0);
  const totalMcap = coins.reduce((s, c) => s + (c.marketCapUsd || 0), 0);
  const totalVol = coins.reduce((s, c) => s + (c.volume24hUsd || 0), 0);
  const marketCap = categoryStats?.market_cap ?? (totalMcap || undefined);
  const volume24h = categoryStats?.volume_24h ?? (totalVol || undefined);

  const withChange = coins.filter((c) => typeof c.change24hPct === "number" && Number.isFinite(c.change24hPct));
  const sortedByGain = [...withChange].sort((a, b) => (b.change24hPct ?? -Infinity) - (a.change24hPct ?? -Infinity));
  const sortedByLoss = [...withChange].sort((a, b) => (a.change24hPct ?? Infinity) - (b.change24hPct ?? Infinity));
  const topGainer = sortedByGain[0];
  const topLoser = sortedByLoss[0];

  const description = CATEGORY_DESCRIPTIONS[category] ?? CATEGORY_DESCRIPTIONS[category.toLowerCase()];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
          Coins in the {title} category. Explore market data, signals, and opportunities.
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

      {description ? (
        <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--b70-text)]">About {title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--b70-text-muted)]">
            {description}
          </p>
        </section>
      ) : null}

      {items.length === 0 ? (
        <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-8 text-center text-sm text-[var(--b70-text-muted)] shadow-sm">
          No tokens in this category yet. Categories are populated from the coin database; coins matching this category will appear here.
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
