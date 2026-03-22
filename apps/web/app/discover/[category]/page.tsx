import Link from "next/link";
import { getCoinsList } from "@/lib/coins";

/** Slug -> human title for display. Covers common CoinGecko category ids. */
const SLUG_TO_TITLE: Record<string, string> = {
  "ai-tokens": "AI Tokens",
  "artificial-intelligence": "Artificial Intelligence",
  "depin-tokens": "DePIN Tokens",
  depin: "DePIN",
  "gaming-tokens": "Gaming Tokens",
  gaming: "Gaming",
  "layer2-tokens": "Layer 2 Tokens",
  "layer-2": "Layer 2",
  defi: "DeFi",
  "layer-1": "Layer 1",
  meme: "Meme",
  "smart-contract-platform": "Smart Contract Platform",
};

/** Convert URL slug to category query for API (e.g. "artificial-intelligence" -> "Artificial Intelligence"). */
function slugToCategoryQuery(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getCategoryTitle(slug: string): string {
  return SLUG_TO_TITLE[slug] ?? slugToCategoryQuery(slug);
}

type PageProps = {
  params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { category } = await params;
  const title = getCategoryTitle(category);
  return {
    title: `${title} · Block70 Discover`,
    description: `Explore ${title} tokens. Market data, signals, and opportunities.`,
    openGraph: {
      title: `${title} · Block70`,
      description: `Explore ${title} tokens.`,
    },
  };
}

export default async function DiscoverCategoryPage({ params }: PageProps) {
  const { category } = await params;
  const title = getCategoryTitle(category);
  const categoryQuery = slugToCategoryQuery(category);

  let items: Awaited<ReturnType<typeof getCoinsList>> = [];
  try {
    items = await getCoinsList({ category: categoryQuery, limit: 100 });
  } catch {
    // optional: show empty state
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
          Coins in the {title} category. Explore market data, signals, and opportunities.
        </p>
      </section>

      {items.length === 0 ? (
        <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-8 text-center text-sm text-[var(--b70-text-muted)] shadow-sm">
          No tokens in this category yet. Categories are populated from the coin database; coins matching &quot;{categoryQuery}&quot; will appear here.
        </section>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.coin.id}>
              <Link
                href={`/coins/${item.coin.slug}`}
                className="block rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 transition hover:bg-[var(--b70-border)]/30"
              >
                <span className="font-semibold text-[var(--b70-text)]">
                  {item.coin.name}
                </span>
                <span className="ml-2 text-xs text-[var(--b70-text-muted)]">
                  {item.coin.symbol}
                </span>
                {item.latest_market_data?.market_cap != null ? (
                  <p className="mt-1 text-xs text-[var(--b70-text-muted)]">
                    MCap: ${(item.latest_market_data.market_cap / 1e6).toFixed(1)}M
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-[var(--b70-text-muted)]">
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
