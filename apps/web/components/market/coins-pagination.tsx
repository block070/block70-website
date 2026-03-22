"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;

type Props = {
  currentPage: number;
  totalPages: number;
  limit: number;
  basePath?: string;
  selectId?: string;
};

function buildHref(page: number, limit: number, basePath: string): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (limit !== 100) params.set("limit", String(limit));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Show up to 5 page numbers in a sliding window, with prev/next/first/last arrows and Show dropdown. */
export function CoinsPagination({
  currentPage,
  totalPages,
  limit,
  basePath = "/coins",
  selectId,
}: Props) {
  const router = useRouter();

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLimit = Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number];
    router.push(buildHref(1, newLimit, basePath)); // reset to page 1 when changing page size
  };

  const windowSize = 5;
  let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  if (end - start + 1 < windowSize) {
    start = Math.max(1, end - windowSize + 1);
  }
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const showPageNav = totalPages > 1;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
      {showPageNav ? (
      <nav
        className="flex items-center justify-center gap-1 text-sm"
        aria-label="Pagination"
      >
        {currentPage <= 1 ? (
          <span
            className="flex h-9 min-w-9 cursor-not-allowed items-center justify-center rounded-lg border border-slate-700 px-2 text-slate-500 opacity-50"
            aria-disabled
          >
            &lt;&lt;
          </span>
        ) : (
          <Link
            href={buildHref(1, limit, basePath)}
            className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-slate-700 px-2 text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
            aria-label="First page"
          >
            &lt;&lt;
          </Link>
        )}
        {currentPage <= 1 ? (
          <span
            className="flex h-9 min-w-9 cursor-not-allowed items-center justify-center rounded-lg border border-slate-700 px-2 text-slate-500 opacity-50"
            aria-disabled
          >
            &lt;
          </span>
        ) : (
          <Link
            href={buildHref(currentPage - 1, limit, basePath)}
            className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-slate-700 px-2 text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
            aria-label="Previous page"
          >
            &lt;
          </Link>
        )}
        <div className="flex items-center gap-1">
          {pages.map((p) =>
            p === currentPage ? (
              <span
                key={p}
                className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-slate-700 font-medium text-slate-100"
                aria-current="page"
              >
                {p}
              </span>
            ) : (
              <Link
                key={p}
                href={buildHref(p, limit, basePath)}
                className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
              >
                {p}
              </Link>
            )
          )}
        </div>
        {currentPage >= totalPages ? (
          <span
            className="flex h-9 min-w-9 cursor-not-allowed items-center justify-center rounded-lg border border-slate-700 px-2 text-slate-500 opacity-50"
            aria-disabled
          >
            &gt;
          </span>
        ) : (
          <Link
            href={buildHref(currentPage + 1, limit, basePath)}
            className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-slate-700 px-2 text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
            aria-label="Next page"
          >
            &gt;
          </Link>
        )}
        {currentPage >= totalPages ? (
          <span
            className="flex h-9 min-w-9 cursor-not-allowed items-center justify-center rounded-lg border border-slate-700 px-2 text-slate-500 opacity-50"
            aria-disabled
          >
            &gt;&gt;
          </span>
        ) : (
          <Link
            href={buildHref(totalPages, limit, basePath)}
            className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-slate-700 px-2 text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
            aria-label="Last page"
          >
            &gt;&gt;
          </Link>
        )}
      </nav>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <label htmlFor={selectId ?? "coins-per-page"}>Show</label>
        <select
          id={selectId ?? "coins-per-page"}
          value={limit}
          onChange={handleLimitChange}
          className="h-9 rounded-lg border border-slate-700 bg-slate-800/60 px-2 text-slate-200 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
