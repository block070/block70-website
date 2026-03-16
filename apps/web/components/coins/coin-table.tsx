"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { Coin } from "@/lib/crypto-mock";

type SortKey =
  | "rank"
  | "name"
  | "symbol"
  | "priceUsd"
  | "change24hPct"
  | "change7dPct"
  | "marketCapUsd"
  | "volume24hUsd"
  | "circulatingSupply";

type SortState = {
  key: SortKey;
  direction: "asc" | "desc";
};

type Props = {
  coins: (Coin & { circulatingSupply?: number })[];
  pageSize?: number;
};

export function CoinTable({ coins, pageSize = 10 }: Props) {
  const router = useRouter();
  const [sort, setSort] = useState<SortState>({ key: "rank", direction: "asc" });
  const [page, setPage] = useState(1);

  const sortedCoins = useMemo(() => {
    const sorted = [...coins].sort((a, b) => {
      const dir = sort.direction === "asc" ? 1 : -1;

      const av = (a as any)[sort.key];
      const bv = (b as any)[sort.key];

      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
    return sorted;
  }, [coins, sort]);

  const pageCount = Math.max(1, Math.ceil(sortedCoins.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleCoins = sortedCoins.slice(startIndex, startIndex + pageSize);

  function toggleSort(key: SortKey) {
    setPage(1);
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "rank" ? "asc" : "desc" },
    );
  }

  function goToCoin(slug: string) {
    router.push(`/coins/${slug}`);
  }

  function renderSortIndicator(key: SortKey) {
    if (sort.key !== key) return null;
    return <span className="ml-1 text-[9px]">{sort.direction === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <HeaderCell onClick={() => toggleSort("rank")}>
                Rank
                {renderSortIndicator("rank")}
              </HeaderCell>
              <HeaderCell onClick={() => toggleSort("name")}>
                Name
                {renderSortIndicator("name")}
              </HeaderCell>
              <HeaderCell onClick={() => toggleSort("symbol")}>
                Symbol
                {renderSortIndicator("symbol")}
              </HeaderCell>
              <HeaderCell align="right" onClick={() => toggleSort("priceUsd")}>
                Price
                {renderSortIndicator("priceUsd")}
              </HeaderCell>
              <HeaderCell align="right" onClick={() => toggleSort("change24hPct")}>
                24h Change
                {renderSortIndicator("change24hPct")}
              </HeaderCell>
              <HeaderCell align="right" onClick={() => toggleSort("change7dPct")}>
                7d Change
                {renderSortIndicator("change7dPct")}
              </HeaderCell>
              <HeaderCell align="right" onClick={() => toggleSort("marketCapUsd")}>
                Market Cap
                {renderSortIndicator("marketCapUsd")}
              </HeaderCell>
              <HeaderCell align="right" onClick={() => toggleSort("volume24hUsd")}>
                Volume
                {renderSortIndicator("volume24hUsd")}
              </HeaderCell>
              <HeaderCell align="right" onClick={() => toggleSort("circulatingSupply")}>
                Circulating Supply
                {renderSortIndicator("circulatingSupply")}
              </HeaderCell>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visibleCoins.map((coin) => (
              <tr
                key={coin.id}
                className="cursor-pointer hover:bg-slate-900/60"
                onClick={() => goToCoin(coin.slug)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goToCoin(coin.slug);
                  }
                }}
              >
                <td className="px-3 py-2 text-slate-500">{coin.rank}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-50">
                      {coin.name}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-400">{coin.symbol}</td>
                <td className="px-3 py-2 text-right text-slate-50">
                  ${coin.priceUsd.toLocaleString()}
                </td>
                <td
                  className={`px-3 py-2 text-right ${
                    coin.change24hPct >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {coin.change24hPct.toFixed(2)}%
                </td>
                <td
                  className={`px-3 py-2 text-right ${
                    coin.change7dPct >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {coin.change7dPct.toFixed(2)}%
                </td>
                <td className="px-3 py-2 text-right text-slate-200">
                  ${Math.round(coin.marketCapUsd).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-slate-200">
                  ${Math.round(coin.volume24hUsd).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-slate-200">
                  {coin.circulatingSupply
                    ? coin.circulatingSupply.toLocaleString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        onChange={(next) => setPage(next)}
      />
    </div>
  );
}

type HeaderCellProps = {
  children: React.ReactNode;
  align?: "left" | "right";
  onClick?: () => void;
};

function HeaderCell({ children, align = "left", onClick }: HeaderCellProps) {
  return (
    <th
      className={`px-3 py-2 font-medium ${
        align === "right" ? "text-right" : "text-left"
      } ${onClick ? "cursor-pointer select-none hover:text-slate-200" : ""}`}
      onClick={onClick}
      scope="col"
    >
      {children}
    </th>
  );
}

type PaginationProps = {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
};

function Pagination({ page, pageCount, onChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-between text-[11px] text-slate-400">
      <div>
        Page{" "}
        <span className="font-medium text-slate-100">
          {page} / {pageCount}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-slate-700 px-2 py-0.5 disabled:opacity-40"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Previous
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-700 px-2 py-0.5 disabled:opacity-40"
          onClick={() => onChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
        >
          Next
        </button>
      </div>
    </div>
  );
}

