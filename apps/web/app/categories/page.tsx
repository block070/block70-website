import Link from "next/link";
import { CategoriesPageClient } from "@/components/categories/categories-page-client";
import {
  applyDominanceToCategories,
  mapCategoryDirectoryToEnriched,
  scoreTrendingCategory,
} from "@/lib/categories-enrichment";
import { getCategoryDirectory, getMarketSummary } from "@/lib/api";
import { withTimeout } from "@/lib/with-timeout";

export const revalidate = 60;

export const metadata = {
  title: "Sector rotation & categories · Block70",
  description:
    "Sector intelligence: dominance, capital inflows and outflows, Block70 scores, and heatmaps. See where liquidity and attention rotate across DeFi, AI, Layer 1, and more.",
};

const VALID_LIMITS = [12, 24, 36, 48, 100] as const;
const DEFAULT_LIMIT = 24;

type PageProps = {
  searchParams: Promise<{ page?: string; limit?: string }>;
};

export default async function CategoriesPage({ searchParams }: PageProps) {
  const { page: pageParam, limit: limitParam } = await searchParams;
  const parsedLimit = parseInt(limitParam ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;
  const limit = (VALID_LIMITS as readonly number[]).includes(parsedLimit)
    ? (parsedLimit as (typeof VALID_LIMITS)[number])
    : DEFAULT_LIMIT;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const FETCH_TIMEOUT_MS = 45_000;
  let result = { items: [] as Awaited<ReturnType<typeof getCategoryDirectory>>["items"], total: 0 };
  let globalMcapUsd: number | null = null;
  try {
    result = await withTimeout(
      getCategoryDirectory({ order: "market_cap_desc", limit, page }),
      FETCH_TIMEOUT_MS,
      { items: [], total: 0 }
    );
  } catch {
    // Show empty state
  }

  try {
    const summary = await withTimeout(getMarketSummary(1), 12_000);
    const g = summary.global?.total_market_cap_usd;
    if (typeof g === "number" && Number.isFinite(g) && g > 0) globalMcapUsd = g;
  } catch {
    // Fall back to page-sum dominance in applyDominanceToCategories
  }

  const { items: rawCategories, total } = result;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const clampedPage = Math.min(page, totalPages);

  const enrichedCategories =
    rawCategories.length > 0
      ? applyDominanceToCategories(
          rawCategories.map(mapCategoryDirectoryToEnriched),
          globalMcapUsd
        )
      : [];

  const trending = [...enrichedCategories]
    .sort((a, b) => scoreTrendingCategory(b) - scoreTrendingCategory(a))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          Categories
        </h1>
        <p className="text-sm text-[var(--b70-text-muted)]">
          Sector rotation and capital flows: dominance vs the global market (when available), inflow and
          outflow rails, Block70 scores, and heatmaps. Use cards for detail or the heatmap for a one-glance
          map.
        </p>
      </header>

      {enrichedCategories.length === 0 ? (
        <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-8 text-center shadow-sm">
          <p className="text-sm text-[var(--b70-text-muted)]">
            No category data available yet. Categories are populated from live market data or the coin
            database.
          </p>
          <Link href="/coins" className="mt-4 inline-block text-sm font-medium text-crypto-blue hover:underline">
            Browse all coins →
          </Link>
        </section>
      ) : (
        <CategoriesPageClient
          categories={enrichedCategories}
          trending={trending}
          page={clampedPage}
          limit={limit}
          total={total}
          totalPages={totalPages}
        />
      )}

      <p className="text-xs text-[var(--b70-text-muted)]">
        <Link href="/coins" className="text-crypto-blue hover:underline">
          Browse all coins
        </Link>
        {" · "}
        <Link href="/signals" className="text-crypto-blue hover:underline">
          Signals
        </Link>
      </p>
    </div>
  );
}
