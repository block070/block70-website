import Link from "next/link";
import { CoinsPagination } from "@/components/market/coins-pagination";
import { getMarketCategories } from "@/lib/api";
import { formatCompactUsd, formatChangePct } from "@/lib/format";

export const metadata = {
  title: "Categories · Block70 Crypto Data",
  description:
    "Crypto asset categories with market cap and 24h volume. Click through to explore coins by category.",
};

const VALID_LIMITS = [10, 25, 50, 100, 200] as const;

type PageProps = {
  searchParams: Promise<{ page?: string; limit?: string }>;
};

export default async function CategoriesPage({ searchParams }: PageProps) {
  const { page: pageParam, limit: limitParam } = await searchParams;
  const parsedLimit = parseInt(limitParam ?? "100", 10) || 100;
  const limit = (VALID_LIMITS as readonly number[]).includes(parsedLimit)
    ? (parsedLimit as (typeof VALID_LIMITS)[number])
    : 100;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  let result = { items: [] as Awaited<ReturnType<typeof getMarketCategories>>["items"], total: 0 };
  try {
    result = await getMarketCategories({
      order: "market_cap_desc",
      limit,
      page,
    });
  } catch {
    // Show empty state
  }

  const { items: categories, total } = result;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const clampedPage = Math.min(page, totalPages);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          Categories
        </h1>
        <p className="text-sm text-[var(--b70-text-muted)]">
          Explore crypto by category. Market cap and 24h volume aggregated across all coins in each category.
        </p>
      </header>

      {categories.length === 0 ? (
        <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-8 text-center shadow-sm">
          <p className="text-sm text-[var(--b70-text-muted)]">
            No category data available yet. Categories are populated from live market data or the coin database.
          </p>
          <Link href="/coins" className="mt-4 inline-block text-sm font-medium text-crypto-blue hover:underline">
            Browse all coins →
          </Link>
        </section>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--b70-border)] bg-[var(--b70-bg)] text-[var(--b70-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Market Cap</th>
                <th className="px-4 py-3 font-medium text-right">24h Volume</th>
                <th className="px-4 py-3 font-medium text-right">24h %</th>
                <th className="px-4 py-3 font-medium">Top Coins</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--b70-border)]">
              {categories.map((cat, i) => (
                <tr
                  key={cat.id}
                  className="transition-colors hover:bg-[var(--b70-bg)]/50"
                >
                  <td className="px-4 py-3 text-[var(--b70-text-muted)]">{(clampedPage - 1) * limit + i + 1}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/discover/${cat.id}`}
                      className="font-medium text-[var(--b70-text)] hover:text-crypto-blue hover:underline"
                    >
                      {cat.name || cat.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[var(--b70-text)]">
                    {formatCompactUsd(cat.market_cap ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--b70-text-muted)]">
                    {formatCompactUsd(cat.volume_24h ?? 0)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right ${
                      cat.market_cap_change_24h != null
                        ? Number(cat.market_cap_change_24h) >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                        : "text-[var(--b70-text-muted)]"
                    }`}
                  >
                    {formatChangePct(cat.market_cap_change_24h ?? NaN)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {Array.isArray(cat.top_coins) && cat.top_coins.length > 0
                        ? cat.top_coins.slice(0, 5).map(({ slug, symbol }) => (
                            <Link
                              key={slug}
                              href={`/coins/${slug}`}
                              className="text-xs font-medium text-[var(--b70-text)] hover:text-crypto-blue hover:underline"
                            >
                              {symbol || slug}
                            </Link>
                          ))
                        : "—"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {categories.length > 0 && (
        <CoinsPagination
          currentPage={clampedPage || 1}
          totalPages={totalPages}
          limit={limit}
          basePath="/categories"
          selectId="categories-per-page"
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
