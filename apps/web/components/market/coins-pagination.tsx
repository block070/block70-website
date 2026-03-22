"use client";

import Link from "next/link";

type Props = {
  currentPage: number;
  totalPages: number;
};

/** Show up to 5 page numbers in a sliding window, with prev/next arrows. */
export function CoinsPagination({ currentPage, totalPages }: Props) {
  if (totalPages <= 1) return null;

  const windowSize = 5;
  let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  if (end - start + 1 < windowSize) {
    start = Math.max(1, end - windowSize + 1);
  }
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <nav
      className="flex items-center justify-center gap-1 text-sm"
      aria-label="Pagination"
    >
      {currentPage <= 1 ? (
        <span
          className="flex h-9 min-w-9 cursor-not-allowed items-center justify-center rounded-lg border border-slate-700 px-2 text-slate-500 opacity-50"
          aria-disabled
        >
          &lt;
        </span>
      ) : (
        <Link
          href={currentPage === 2 ? "/coins" : `/coins?page=${currentPage - 1}`}
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
              href={p === 1 ? "/coins" : `/coins?page=${p}`}
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
          href={`/coins?page=${currentPage + 1}`}
          className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-slate-700 px-2 text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
          aria-label="Next page"
        >
          &gt;
        </Link>
      )}
    </nav>
  );
}
