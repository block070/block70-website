"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, ExternalLink, HelpCircle } from "lucide-react";
import { getExchanges, trackExchangeClick, type ExchangeDto } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const VOL_SNAP_KEY = "b70-exchange-vol-session";

function formatVolume(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(2)}K`;
  return `$${usd.toFixed(0)}`;
}

function liquidityIndex(ex: ExchangeDto): number {
  if (typeof ex.liquidity_score === "number" && Number.isFinite(ex.liquidity_score)) {
    return ex.liquidity_score;
  }
  return 0;
}

type SortKey = "trust_score_rank" | "volume" | "trust_score" | "liquidity_score";

type FilterKey = "all" | "10" | "25" | "50";

function ActivityCell({
  volume,
  prevVol,
}: {
  volume: number;
  prevVol: number | undefined;
}) {
  if (prevVol == null || !Number.isFinite(prevVol)) {
    return (
      <span className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-text-muted)]">
        —
      </span>
    );
  }
  const eps = Math.max(volume, prevVol) * 1e-6;
  if (Math.abs(volume - prevVol) <= eps) {
    return (
      <span
        className="inline-flex items-center gap-0.5 font-[family-name:var(--font-jetbrains)] text-[var(--b70-text-muted)]"
        title="Session estimate: 24h volume vs last snapshot in this browser tab"
      >
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        flat
      </span>
    );
  }
  if (volume > prevVol) {
    return (
      <span
        className="inline-flex items-center gap-0.5 font-[family-name:var(--font-jetbrains)] text-emerald-600 dark:text-emerald-400"
        title="Session estimate: 24h volume vs last snapshot in this browser tab"
      >
        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
        up
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 font-[family-name:var(--font-jetbrains)] text-rose-600 dark:text-rose-400"
      title="Session estimate: 24h volume vs last snapshot in this browser tab"
    >
      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
      down
    </span>
  );
}

export function ExchangesLiquidityClient() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortBy, setSortBy] = useState<SortKey>("trust_score_rank");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [prevVolById, setPrevVolById] = useState<Record<string, number>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: exchanges, isLoading, error } = useSWR<ExchangeDto[]>(
    "exchanges-list",
    getExchanges,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  useEffect(() => {
    if (!exchanges?.length) return;
    let stored: Record<string, number> = {};
    try {
      const raw = sessionStorage.getItem(VOL_SNAP_KEY);
      if (raw) stored = JSON.parse(raw) as Record<string, number>;
    } catch {
      stored = {};
    }
    setPrevVolById(stored);

    const id = requestAnimationFrame(() => {
      const next: Record<string, number> = {};
      for (const ex of exchanges) next[ex.id] = ex.trade_volume_24h_usd;
      try {
        sessionStorage.setItem(VOL_SNAP_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [exchanges]);

  const filtered = useMemo(() => {
    let list = exchanges ?? [];
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.slug || "").toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q),
      );
    }
    const limit =
      filter === "10" ? 10 : filter === "25" ? 25 : filter === "50" ? 50 : list.length;
    if (sortBy === "volume") {
      list = [...list].sort((a, b) => b.trade_volume_24h_usd - a.trade_volume_24h_usd);
    } else if (sortBy === "trust_score") {
      list = [...list].sort((a, b) => b.trust_score - a.trust_score);
    } else if (sortBy === "liquidity_score") {
      list = [...list].sort((a, b) => liquidityIndex(b) - liquidityIndex(a));
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
          Venues
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          Exchanges & liquidity
        </h1>
        <p className="text-sm text-[var(--b70-text-muted)]">
          Volume and trust-focused leaderboard. Liquidity index is a heuristic from list metadata—not
          order-book depth. Exchange data from{" "}
          <a
            href="https://www.coingecko.com/en/exchanges"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--b70-crypto-blue)] hover:underline"
          >
            CoinGecko
          </a>
          .
        </p>
      </header>

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
        <h2 className="text-xs font-semibold text-[var(--b70-text)]">Exchange flows & reserves</h2>
        <p className="mt-1 text-xs text-[var(--b70-text-muted)] leading-relaxed">
          Block70 does not ingest proprietary exchange reserve or wallet-flow panels. For on-chain capital
          movement context, see{" "}
          <Link
            href="/flows"
            className="font-medium text-[var(--b70-crypto-blue)] hover:underline"
          >
            flows
          </Link>
          .
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search exchange…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-64 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 text-sm text-[var(--b70-text)] placeholder:text-[var(--b70-text-muted)] focus:border-[var(--b70-crypto-blue)] focus:outline-none"
        />
        <div className="flex gap-1">
          {(["all", "10", "25", "50"] as FilterKey[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? "border border-[var(--b70-crypto-blue)]/40 bg-[var(--b70-crypto-blue)]/15 text-[var(--b70-crypto-blue)]"
                  : "border border-transparent bg-[var(--b70-bg)] text-[var(--b70-text-muted)] hover:border-[var(--b70-border)]"
              }`}
            >
              {f === "all" ? "All" : `Top ${f}`}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="h-9 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 text-sm text-[var(--b70-text)] focus:border-[var(--b70-crypto-blue)] focus:outline-none"
        >
          <option value="trust_score_rank">Trust rank</option>
          <option value="volume">24h volume</option>
          <option value="trust_score">Trust score</option>
          <option value="liquidity_score">Liquidity index</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-[var(--b70-text-muted)]">
            Failed to load exchanges. Please try again.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-[var(--b70-border)] bg-[var(--b70-bg)] text-[var(--b70-text-muted)]">
                <tr>
                  <th className="px-3 py-3 font-medium">#</th>
                  <th className="px-3 py-3 font-medium">Exchange</th>
                  <th className="px-3 py-3 text-right font-medium">24h volume</th>
                  <th className="px-3 py-3 font-medium">Trust</th>
                  <th className="px-3 py-3 font-medium">
                    <span
                      className="inline-flex items-center gap-1"
                      title="Heuristic index from list metadata, not measured order-book depth"
                    >
                      Liq. index
                      <HelpCircle className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    </span>
                  </th>
                  <th className="px-3 py-3 font-medium">Fees</th>
                  <th className="px-3 py-3 font-medium">Activity</th>
                  <th className="hidden px-3 py-3 font-medium md:table-cell">Country</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--b70-border)]">
                {filtered.map((ex) => (
                  <tr
                    key={ex.id}
                    className="transition-colors hover:bg-[var(--b70-bg)]/80"
                  >
                    <td className="px-3 py-3 font-[family-name:var(--font-jetbrains)] text-[var(--b70-text-muted)]">
                      {ex.trust_score_rank}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/exchanges/${ex.slug || ex.id}`}
                        className="flex items-center gap-2 text-[var(--b70-text)] hover:text-[var(--b70-crypto-blue)]"
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
                          <div className="h-7 w-7 rounded-full bg-[var(--b70-border)]" />
                        )}
                        <span className="font-medium">{ex.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right font-[family-name:var(--font-jetbrains)] font-medium text-[var(--b70-text)]">
                      {formatVolume(ex.trade_volume_24h_usd)}
                    </td>
                    <td className="px-3 py-3 font-[family-name:var(--font-jetbrains)] text-[var(--b70-text)]">
                      {ex.trust_score.toFixed(1)}
                    </td>
                    <td
                      className="px-3 py-3 font-[family-name:var(--font-jetbrains)] text-[var(--b70-text)]"
                      title="Heuristic index from list metadata, not measured order-book depth"
                    >
                      {liquidityIndex(ex).toFixed(2)}
                    </td>
                    <td className="px-3 py-3">
                      <a
                        href={ex.final_url || ex.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          handleVisit(ex);
                        }}
                        className="inline-flex items-center gap-1 text-[var(--b70-crypto-blue)] hover:underline"
                      >
                        Tiered / see venue
                        <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    </td>
                    <td className="px-3 py-3">
                      <ActivityCell
                        volume={ex.trade_volume_24h_usd}
                        prevVol={prevVolById[ex.id]}
                      />
                    </td>
                    <td className="hidden px-3 py-3 text-[var(--b70-text-muted)] md:table-cell">
                      {ex.country ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/exchanges/${ex.slug || ex.id}`}
                          className="rounded-lg border border-[var(--b70-border)] px-2.5 py-1 text-[10px] font-medium text-[var(--b70-text)] hover:border-[var(--b70-crypto-blue)]/50"
                        >
                          Profile
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleVisit(ex)}
                          className="rounded-lg bg-[var(--b70-crypto-blue)]/15 px-2.5 py-1 text-[10px] font-medium text-[var(--b70-crypto-blue)] hover:bg-[var(--b70-crypto-blue)]/25"
                        >
                          Visit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="p-8 text-center text-[var(--b70-text-muted)]">
            No exchanges match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
