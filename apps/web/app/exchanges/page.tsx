"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { getExchanges, trackExchangeClick, type ExchangeDto } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

function formatVolume(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(2)}K`;
  return `$${usd.toFixed(0)}`;
}

type SortKey = "trust_score_rank" | "volume" | "trust_score";
type FilterKey = "all" | "10" | "25" | "50";

export default function ExchangesPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortBy, setSortBy] = useState<SortKey>("trust_score_rank");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: exchanges, isLoading, error } = useSWR<ExchangeDto[]>(
    "exchanges-list",
    getExchanges,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const filtered = useMemo(() => {
    let list = exchanges ?? [];
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.slug || "").toLowerCase().includes(q)
      );
    }
    const limit =
      filter === "10" ? 10 : filter === "25" ? 25 : filter === "50" ? 50 : list.length;
    if (sortBy === "volume") {
      list = [...list].sort((a, b) => b.trade_volume_24h_usd - a.trade_volume_24h_usd);
    } else if (sortBy === "trust_score") {
      list = [...list].sort((a, b) => b.trust_score - a.trust_score);
    } else {
      list = [...list].sort((a, b) => a.trust_score_rank - b.trust_score_rank);
    }
    return list.slice(0, limit);
  }, [exchanges, debouncedSearch, filter, sortBy]);

  const handleVisit = useCallback((ex: ExchangeDto) => {
    trackExchangeClick(ex.id);
    window.open(ex.final_url || ex.url, "_blank", "noopener,noreferrer");
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Exchanges</h1>
        <p className="text-sm text-slate-400">
          Centralized and on-chain venues where Block70 routes opportunities.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by exchange name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <div className="flex gap-1">
          {(["all", "10", "25", "50"] as FilterKey[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                filter === f
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-slate-800/60 text-slate-400 hover:bg-slate-700/60"
              }`}
            >
              {f === "all" ? "All" : `Top ${f}`}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
        >
          <option value="trust_score_rank">Rank</option>
          <option value="volume">Volume DESC</option>
          <option value="trust_score">Trust Score DESC</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-slate-400">
            Failed to load exchanges. Please try again.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900/95 text-slate-400">
                <tr>
                  <th className="px-3 py-3 font-medium">Rank</th>
                  <th className="px-3 py-3 font-medium">Exchange</th>
                  <th className="px-3 py-3 font-medium">Trust Score</th>
                  <th className="px-3 py-3 text-right font-medium">24h Volume</th>
                  <th className="px-3 py-3 font-medium">Country</th>
                  <th className="px-3 py-3 font-medium">Year</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((ex) => (
                  <tr
                    key={ex.id}
                    className="hover:bg-slate-900/60 transition-colors"
                  >
                    <td className="px-3 py-3 text-slate-400">
                      #{ex.trust_score_rank}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/exchanges/${ex.slug || ex.id}`}
                        className="flex items-center gap-2 text-slate-50 hover:text-emerald-400"
                      >
                        {ex.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ex.image}
                            alt=""
                            width={28}
                            height={28}
                            className="rounded-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-slate-700" />
                        )}
                        <span className="font-medium">{ex.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {ex.trust_score}/10
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-slate-200">
                      {formatVolume(ex.trade_volume_24h_usd)}
                    </td>
                    <td className="px-3 py-3 text-slate-400">
                      {ex.country ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-400">
                      {ex.year_established ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleVisit(ex)}
                        className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30"
                      >
                        Visit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            No exchanges match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
