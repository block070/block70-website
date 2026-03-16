import Link from "next/link";
import { getCoinsList } from "@/lib/coins";
import { notFound } from "next/navigation";

const CATEGORIES: Record<string, { title: string; description: string }> = {
  "ai-tokens": {
    title: "Best AI Tokens",
    description: "AI and machine learning crypto tokens. Track signals and opportunities for AI narrative plays.",
  },
  "depin-tokens": {
    title: "DePIN Tokens",
    description: "Decentralized physical infrastructure tokens. DePIN tokens whales are buying and Block70 signals.",
  },
  "gaming-tokens": {
    title: "Gaming Tokens",
    description: "Gaming and metaverse crypto tokens. Leaderboards, signals, and alpha.",
  },
  "layer2-tokens": {
    title: "Layer 2 Tokens",
    description: "Layer 2 scaling and rollup tokens. L2 ecosystem signals and flows.",
  },
};

type PageProps = {
  params: Promise<{ category: string }>;
};

export async function generateStaticParams() {
  return Object.keys(CATEGORIES).map((category) => ({ category }));
}

export async function generateMetadata({ params }: PageProps) {
  const { category } = await params;
  const meta = CATEGORIES[category];
  if (!meta) return {};
  return {
    title: `${meta.title} · Block70 Discover`,
    description: meta.description,
    openGraph: {
      title: `${meta.title} · Block70`,
      description: meta.description,
    },
  };
}

export default async function DiscoverCategoryPage({ params }: PageProps) {
  const { category } = await params;
  const meta = CATEGORIES[category];
  if (!meta) notFound();

  const categoryQuery = category.replace("-tokens", "").replace("-", " ");
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
          {meta.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
          {meta.description}
        </p>
      </section>

      {items.length === 0 ? (
        <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-8 text-center text-sm text-[var(--b70-text-muted)]">
          No tokens in this category yet. Categories are populated from the coin database; add coins with category “{categoryQuery}” to see them here.
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
