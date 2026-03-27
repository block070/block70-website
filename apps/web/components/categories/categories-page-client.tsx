"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CoinsPagination } from "@/components/market/coins-pagination";
import type { EnrichedCategory } from "@/lib/categories-enrichment";
import { inferSector, mcapBucket } from "@/lib/categories-enrichment";
import { getCategoryDescription } from "@/lib/category-descriptions";
import { buildCategorySeoHtml } from "@/lib/category-seo-longform";
import { useExchangeAffiliateTemplates } from "@/contexts/exchange-affiliate-context";
import { getExchangeBuyUrls } from "@/lib/exchange-buy-urls";
import { formatChangePct, formatCompactUsd } from "@/lib/format";
import { clsx } from "clsx";

type SortKey = "score" | "change" | "growth" | "mcap" | "inflows" | "coins" | "volume";

const FLOW_RAIL_LIMIT = 8;

function flowPriority(flow: EnrichedCategory["capitalFlow"]): number {
  if (flow === "in") return 0;
  if (flow === "neutral") return 1;
  return 2;
}

function heatmapMetric(c: EnrichedCategory): number | null {
  const m = c.market_cap_change_24h;
  if (typeof m === "number" && Number.isFinite(m)) return m;
  if (Number.isFinite(c.avgChange24h)) return c.avgChange24h;
  return null;
}

function heatmapBackground(t: number, minV: number, maxV: number): { background: string; border: string } {
  if (!Number.isFinite(minV) || !Number.isFinite(maxV) || Math.abs(maxV - minV) < 1e-9) {
    return { background: "rgba(100,116,139,0.22)", border: "rgba(100,116,139,0.45)" };
  }
  const u = Math.max(0, Math.min(1, (t - minV) / (maxV - minV)));
  const r = Math.round(220 * (1 - u) + 52 * u);
  const g = Math.round(38 * (1 - u) + 211 * u);
  const b = Math.round(38 * (1 - u) + 153 * u);
  return {
    background: `rgba(${r},${g},${b},0.38)`,
    border: `rgba(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)},0.65)`,
  };
}

function useDarkModeFlag(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      setDark(root.classList.contains("dark") || (!root.classList.contains("light") && mq.matches));
    };
    sync();
    mq.addEventListener("change", sync);
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      mq.removeEventListener("change", sync);
      obs.disconnect();
    };
  }, []);
  return dark;
}
type SectorFilter = "all" | string;
type McapFilter = "all" | "large" | "mid" | "small";

type Props = {
  categories: EnrichedCategory[];
  trending: EnrichedCategory[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function TrendBadge({ trend }: { trend: EnrichedCategory["trend"] }) {
  const cfg =
    trend === "bullish"
      ? { label: "Bullish", className: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" }
      : trend === "bearish"
        ? { label: "Bearish", className: "border-red-500/50 bg-red-500/15 text-red-300" }
        : { label: "Neutral", className: "border-amber-500/45 bg-amber-500/12 text-amber-200" };
  return (
    <span
      className={clsx(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

function CapitalFlowBadge({ flow }: { flow: EnrichedCategory["capitalFlow"] }) {
  if (flow === "in") {
    return (
      <span className="text-[11px] font-medium text-emerald-400">Money flowing in</span>
    );
  }
  if (flow === "out") {
    return <span className="text-[11px] font-medium text-red-400">Money flowing out</span>;
  }
  return <span className="text-[11px] text-[var(--b70-text-muted)]">Balanced flow</span>;
}

function CategoriesHeatmap({ items }: { items: EnrichedCategory[] }) {
  const dark = useDarkModeFlag();
  const totalMcap = items.reduce((s, c) => s + Math.max(1, c.market_cap || 0), 0) || 1;
  const metrics = items.map(heatmapMetric).filter((v): v is number => v != null && Number.isFinite(v));
  const minV = metrics.length ? Math.min(...metrics) : 0;
  const maxV = metrics.length ? Math.max(...metrics) : 0;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((cat) => {
        const m = heatmapMetric(cat);
        const colors =
          m != null && Number.isFinite(m)
            ? heatmapBackground(m, minV, maxV)
            : dark
              ? { background: "rgba(30,41,59,0.6)", border: "rgba(71,85,105,0.5)" }
              : { background: "rgba(241,245,249,0.9)", border: "rgba(148,163,184,0.6)" };
        const w = Math.max(12, Math.min(42, ((cat.market_cap || 0) / totalMcap) * 100));
        return (
          <Link
            key={cat.id}
            href={`/categories/${encodeURIComponent(cat.id)}`}
            className="flex min-h-[72px] flex-col justify-between rounded-xl border p-3 text-left transition hover:brightness-110"
            style={{
              flex: `1 1 ${w}%`,
              minWidth: "140px",
              background: colors.background,
              borderColor: colors.border,
            }}
          >
            <span className="line-clamp-2 text-xs font-semibold text-[var(--b70-text)]">{cat.name}</span>
            <span className="text-[10px] text-[var(--b70-text-muted)]">
              {formatCompactUsd(cat.market_cap ?? 0)} · {formatChangePct(cat.market_cap_change_24h ?? NaN)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function CategoriesPageClient({
  categories: initialCategories,
  trending,
  page,
  limit,
  total,
  totalPages,
}: Props) {
  const [view, setView] = useState<"cards" | "heatmap">("cards");
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [sector, setSector] = useState<SectorFilter>("all");
  const [mcap, setMcap] = useState<McapFilter>("all");
  const affiliateTemplates = useExchangeAffiliateTemplates();

  const categories = useMemo(() => {
    let list = [...initialCategories];
    if (sector !== "all") {
      list = list.filter((c) => inferSector(c.id, c.name) === sector);
    }
    if (mcap !== "all") {
      list = list.filter((c) => mcapBucket(c.market_cap ?? 0) === mcap);
    }
    const dir = -1;
    list.sort((a, b) => {
      if (sortBy === "score") return dir * (a.avgBlock70 - b.avgBlock70);
      if (sortBy === "change") {
        const av = Number.isFinite(a.avgChange24h) ? a.avgChange24h : -Infinity;
        const bv = Number.isFinite(b.avgChange24h) ? b.avgChange24h : -Infinity;
        return dir * (av - bv);
      }
      if (sortBy === "growth") {
        const am = a.market_cap_change_24h;
        const bm = b.market_cap_change_24h;
        const av = typeof am === "number" && Number.isFinite(am) ? am : -Infinity;
        const bv = typeof bm === "number" && Number.isFinite(bm) ? bm : -Infinity;
        return dir * (av - bv);
      }
      if (sortBy === "mcap") return dir * ((a.market_cap ?? 0) - (b.market_cap ?? 0));
      if (sortBy === "inflows") {
        const fp = flowPriority(a.capitalFlow) - flowPriority(b.capitalFlow);
        if (fp !== 0) return fp;
        const am = a.market_cap_change_24h;
        const bm = b.market_cap_change_24h;
        const av = typeof am === "number" && Number.isFinite(am) ? am : -Infinity;
        const bv = typeof bm === "number" && Number.isFinite(bm) ? bm : -Infinity;
        if (bv !== av) return bv - av;
        return (b.volToMcap ?? 0) - (a.volToMcap ?? 0);
      }
      if (sortBy === "coins") return dir * (a.coinCount - b.coinCount);
      return dir * ((a.volume_24h ?? 0) - (b.volume_24h ?? 0));
    });
    return list;
  }, [initialCategories, sortBy, sector, mcap]);

  const inflowRail = useMemo(() => {
    return [...categories]
      .filter((c) => c.capitalFlow === "in")
      .sort((a, b) => {
        const am = a.market_cap_change_24h;
        const bm = b.market_cap_change_24h;
        const av = typeof am === "number" && Number.isFinite(am) ? am : -Infinity;
        const bv = typeof bm === "number" && Number.isFinite(bm) ? bm : -Infinity;
        return bv - av;
      })
      .slice(0, FLOW_RAIL_LIMIT);
  }, [categories]);

  const outflowRail = useMemo(() => {
    return [...categories]
      .filter((c) => c.capitalFlow === "out")
      .sort((a, b) => {
        const am = a.market_cap_change_24h;
        const bm = b.market_cap_change_24h;
        const av = typeof am === "number" && Number.isFinite(am) ? am : Infinity;
        const bv = typeof bm === "number" && Number.isFinite(bm) ? bm : Infinity;
        return av - bv;
      })
      .slice(0, FLOW_RAIL_LIMIT);
  }, [categories]);

  const sectorOptions = useMemo(() => {
    const s = new Set<string>();
    initialCategories.forEach((c) => s.add(inferSector(c.id, c.name)));
    return ["all", ...Array.from(s).sort()];
  }, [initialCategories]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-950/40 to-[var(--b70-card)] p-5 shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xl" aria-hidden>
            🔥
          </span>
          <h2 className="text-lg font-semibold text-[var(--b70-text)]">Trending categories</h2>
        </div>
        <p className="mt-1 text-xs text-[var(--b70-text-muted)]">
          Highest blend of volume momentum and average Block70 score — updated with this page load.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trending.slice(0, 5).map((c) => {
            const top = c.top3[0];
            return (
              <Link
                key={c.id}
                href={`/categories/${encodeURIComponent(c.id)}`}
                className="group rounded-xl border border-[var(--b70-border)] bg-[var(--b70-bg)]/50 p-4 transition hover:border-crypto-blue/40 hover:bg-[var(--b70-bg)]"
              >
                <p className="font-semibold text-[var(--b70-text)] group-hover:text-crypto-blue">{c.name}</p>
                <p className="mt-1 text-xs text-[var(--b70-text-muted)]">
                  Avg score <span className="font-medium text-slate-200">{c.avgBlock70}</span>
                  {" · "}
                  <span
                    className={
                      Number.isFinite(c.avgChange24h) && c.avgChange24h >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }
                  >
                    {formatChangePct(c.avgChange24h)}
                  </span>{" "}
                  avg 24h
                </p>
                {top && (
                  <p className="mt-2 text-[11px] text-[var(--b70-text-muted)]">
                    Top:{" "}
                    <span className="font-medium text-[var(--b70-text)]">{top.name}</span>{" "}
                    {formatChangePct(top.change24hPct)}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="rounded-xl border border-dashed border-[var(--b70-border)] bg-[var(--b70-bg)]/40 p-4 text-center text-xs text-[var(--b70-text-muted)]">
        <span className="font-medium text-[var(--b70-text)]">Trade with major venues — </span>
        compare fees on{" "}
        <Link href="/exchanges" className="text-crypto-blue hover:underline">
          exchanges
        </Link>
        . Block70 may earn affiliate compensation; see our disclosure.
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] p-1">
          <button
            type="button"
            onClick={() => setView("cards")}
            className={clsx(
              "rounded-md px-4 py-2 text-xs font-semibold transition",
              view === "cards"
                ? "bg-crypto-blue text-white"
                : "text-[var(--b70-text-muted)] hover:text-[var(--b70-text)]"
            )}
          >
            Card view
          </button>
          <button
            type="button"
            onClick={() => setView("heatmap")}
            className={clsx(
              "rounded-md px-4 py-2 text-xs font-semibold transition",
              view === "heatmap"
                ? "bg-crypto-blue text-white"
                : "text-[var(--b70-text-muted)] hover:text-[var(--b70-text)]"
            )}
          >
            Heatmap
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-[var(--b70-text-muted)]">Sort</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-2 py-1.5 text-xs text-[var(--b70-text)]"
          >
            <option value="score">Highest avg Block70 score</option>
            <option value="change">Highest avg coin 24h %</option>
            <option value="growth">Highest 24h sector cap growth %</option>
            <option value="mcap">Largest sector market cap</option>
            <option value="inflows">Capital inflow bias (then sector cap growth)</option>
            <option value="coins">Most coins (sample)</option>
            <option value="volume">Most volume</option>
          </select>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value as SectorFilter)}
            className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-2 py-1.5 text-xs text-[var(--b70-text)]"
          >
            {sectorOptions.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All sectors" : s}
              </option>
            ))}
          </select>
          <select
            value={mcap}
            onChange={(e) => setMcap(e.target.value as McapFilter)}
            className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-2 py-1.5 text-xs text-[var(--b70-text)]"
          >
            <option value="all">All market cap sizes</option>
            <option value="large">Large (&gt;$100B)</option>
            <option value="mid">Mid ($10B–$100B)</option>
            <option value="small">Small (&lt;$10B)</option>
          </select>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
            Inflows
          </h3>
          <p className="mt-1 text-[10px] text-[var(--b70-text-muted)]">
            Categories flagged “in” by capital-flow rules, ranked by 24h sector cap change.
          </p>
          {inflowRail.length === 0 ? (
            <p className="mt-3 text-xs text-[var(--b70-text-muted)]">None in the current filters.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {inflowRail.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/categories/${encodeURIComponent(c.id)}`}
                    className="flex items-center justify-between gap-2 text-xs hover:text-crypto-blue"
                  >
                    <span className="truncate font-medium text-[var(--b70-text)]">{c.name}</span>
                    <span
                      className={clsx(
                        "shrink-0 tabular-nums",
                        typeof c.market_cap_change_24h === "number" && c.market_cap_change_24h >= 0
                          ? "text-emerald-400"
                          : "text-[var(--b70-text-muted)]"
                      )}
                    >
                      {formatChangePct(c.market_cap_change_24h ?? NaN)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-red-400">
            Outflows
          </h3>
          <p className="mt-1 text-[10px] text-[var(--b70-text-muted)]">
            Categories flagged “out”; weakest 24h sector cap change first.
          </p>
          {outflowRail.length === 0 ? (
            <p className="mt-3 text-xs text-[var(--b70-text-muted)]">None in the current filters.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {outflowRail.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/categories/${encodeURIComponent(c.id)}`}
                    className="flex items-center justify-between gap-2 text-xs hover:text-crypto-blue"
                  >
                    <span className="truncate font-medium text-[var(--b70-text)]">{c.name}</span>
                    <span
                      className={clsx(
                        "shrink-0 tabular-nums",
                        typeof c.market_cap_change_24h === "number" && c.market_cap_change_24h < 0
                          ? "text-red-400"
                          : "text-[var(--b70-text-muted)]"
                      )}
                    >
                      {formatChangePct(c.market_cap_change_24h ?? NaN)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {view === "heatmap" ? (
        <CategoriesHeatmap items={categories} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {categories.map((cat) => {
            const tradeSlug = cat.top3[0]?.slug;
            const tradeSym = cat.top3[0]?.symbol ?? "BTC";
            const tradeUrl = tradeSlug
              ? getExchangeBuyUrls(tradeSym, tradeSlug, affiliateTemplates).coinbase
              : getExchangeBuyUrls("BTC", "bitcoin", affiliateTemplates).coinbase;
            const seoHtml = buildCategorySeoHtml(cat.id, cat.name, cat.top3);
            return (
              <article
                key={cat.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-crypto-blue/35 hover:shadow-md"
              >
                <Link
                  href={`/categories/${encodeURIComponent(cat.id)}`}
                  className="flex flex-1 flex-col p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold leading-snug text-[var(--b70-text)] group-hover:text-crypto-blue">
                      {cat.name}
                    </h2>
                    <TrendBadge trend={cat.trend} />
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--b70-text-muted)]">
                    {getCategoryDescription(cat.id, cat.name)}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                    <div>
                      <dt className="text-[var(--b70-text-muted)]">Coins (sample)</dt>
                      <dd className="font-semibold tabular-nums text-[var(--b70-text)]">{cat.coinCount}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--b70-text-muted)]">Avg 24h %</dt>
                      <dd
                        className={clsx(
                          "font-semibold tabular-nums",
                          Number.isFinite(cat.avgChange24h) && cat.avgChange24h >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        )}
                      >
                        {formatChangePct(cat.avgChange24h)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--b70-text-muted)]">Avg Block70</dt>
                      <dd className="font-semibold tabular-nums text-amber-200">{cat.avgBlock70}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--b70-text-muted)]">Sector cap</dt>
                      <dd className="font-medium text-[var(--b70-text)]">
                        {formatCompactUsd(cat.market_cap ?? 0)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--b70-text-muted)]">Dominance</dt>
                      <dd className="font-semibold tabular-nums text-[var(--b70-text)]">
                        {cat.dominancePct != null && Number.isFinite(cat.dominancePct) ? (
                          <span
                            title={
                              cat.dominanceBasis === "global"
                                ? "Share of total crypto market cap (market summary)."
                                : "Share of summed sector caps on this page only — global total unavailable."
                            }
                          >
                            {cat.dominancePct.toFixed(2)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--b70-border)] pt-2">
                    <span className="text-[10px] uppercase tracking-wide text-[var(--b70-text-muted)]">
                      Capital flow
                    </span>
                    <CapitalFlowBadge flow={cat.capitalFlow} />
                  </div>
                  {cat.top3[0] && (
                    <p className="mt-2 text-[11px] text-[var(--b70-text-muted)]">
                      Top performer:{" "}
                      <span className="font-medium text-emerald-300">{cat.top3[0].name}</span>{" "}
                      {formatChangePct(cat.top3[0].change24hPct)}
                    </p>
                  )}
                  <div className="mt-3 space-y-1.5 border-t border-[var(--b70-border)] pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
                      Top coins (by score)
                    </p>
                    <ul className="space-y-1.5">
                      {cat.top3.map((t) => (
                        <li key={t.slug} className="flex items-center justify-between text-xs">
                          <Link
                            href={`/coins/${encodeURIComponent(t.slug)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="truncate font-medium text-[var(--b70-text)] hover:text-crypto-blue hover:underline"
                          >
                            {t.name}
                          </Link>
                          <span className="flex shrink-0 items-center gap-2 tabular-nums">
                            <span
                              className={
                                t.change24hPct >= 0 ? "text-emerald-400" : "text-red-400"
                              }
                            >
                              {formatChangePct(t.change24hPct)}
                            </span>
                            <span className="text-amber-200/90">{t.block70Score}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Link>
                <div className="border-t border-[var(--b70-border)] bg-[var(--b70-bg)]/50 px-4 py-3">
                  <a
                    href={tradeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center rounded-lg bg-blue-600 py-2 text-center text-xs font-semibold text-white transition hover:bg-blue-500"
                  >
                    Trade top coins in {cat.name.slice(0, 28)}
                    {cat.name.length > 28 ? "…" : ""}
                  </a>
                  <details className="mt-3 group/details">
                    <summary className="cursor-pointer list-none text-xs font-medium text-crypto-blue hover:underline [&::-webkit-details-marker]:hidden">
                      <span className="inline-flex items-center gap-1">
                        Learn more about {cat.name}
                        <span className="text-[var(--b70-text-muted)] transition group-open/details:rotate-180">
                          ▼
                        </span>
                      </span>
                    </summary>
                    <div
                      className="mt-3 max-h-[320px] overflow-y-auto border-t border-[var(--b70-border)] pt-3"
                      dangerouslySetInnerHTML={{ __html: seoHtml }}
                    />
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {categories.length === 0 && (
        <p className="text-center text-sm text-[var(--b70-text-muted)]">
          No categories match your filters. Reset filters or broaden sector.
        </p>
      )}

      {totalPages > 1 && (
        <CoinsPagination
          currentPage={page}
          totalPages={totalPages}
          limit={limit}
          basePath="/categories"
          selectId="categories-per-page"
          pageSizeOptions={[12, 24, 36, 48, 100]}
          defaultPageSize={24}
        />
      )}

      <p className="text-xs text-[var(--b70-text-muted)]">
        Showing {categories.length} of {initialCategories.length} on this page after filters · {total} categories
        indexed. Coin–category coverage depends on database snapshots and backfills; some tokens may be missing
        from a given sector until data jobs run.
      </p>
    </div>
  );
}
