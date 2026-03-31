"use client";

import { hierarchy, treemap, type HierarchyRectangularNode } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type HeatmapCoin = {
  symbol: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
};

/** Total min height for homepage layout parity (heatmap title + controls + 560px chart + section padding). */
export const HEATMAP_HOME_COLUMN_MIN_HEIGHT_PX = 658;

type MarketHeatmapProps = {
  coins?: HeatmapCoin[];
  /** Cap tiles (homepage uses 10: five gainers + five losers). */
  maxTiles?: number;
  /**
   * Grow with parent (e.g. homepage grid next to volume spikes). Chart height follows
   * the container instead of a fixed 560px.
   */
  fillHeight?: boolean;
};

type HeatmapFilter = "all" | "gainers" | "losers";

type TreemapNode = HeatmapCoin & {
  size: number;
};

function isTreemapNode(value: unknown): value is TreemapNode {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.slug === "string" &&
    typeof v.symbol === "string" &&
    typeof v.name === "string" &&
    typeof v.price === "number" &&
    typeof v.change24h === "number" &&
    typeof v.marketCap === "number" &&
    typeof v.volume24h === "number"
  );
}

function formatPrice(value: number): string {
  if (value >= 1000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toFixed(0)}`;
}

function colorForChange(change: number): string {
  if (change > 0) {
    if (change >= 8) return "#16a34a";
    if (change >= 2) return "#22c55e";
    return "#4ade80";
  }
  if (change < 0) {
    if (change <= -8) return "#dc2626";
    if (change <= -2) return "#f87171";
    return "#fb7185";
  }
  return "#64748b";
}

const DEFAULT_CHART_H = 560;
const FILL_MIN_CHART_H = 280;

export function MarketHeatmap({ coins = [], maxTiles = 50, fillHeight = false }: MarketHeatmapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const [containerWidth, setContainerWidth] = useState(0);
  const [chartHeight, setChartHeight] = useState(fillHeight ? FILL_MIN_CHART_H : DEFAULT_CHART_H);
  const [filter, setFilter] = useState<HeatmapFilter>("all");

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const update = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.max(0, Math.floor(rect.width));
      const h = Math.max(0, Math.floor(rect.height));
      const nextChartH = !fillHeight
        ? DEFAULT_CHART_H
        : h > 0
          ? Math.max(FILL_MIN_CHART_H, h)
          : FILL_MIN_CHART_H;
      if (width === lastSizeRef.current.w && nextChartH === lastSizeRef.current.h) return;
      lastSizeRef.current = { w: width, h: nextChartH };
      setContainerWidth(width > 0 ? width : 0);
      setChartHeight(nextChartH);
    };

    update();
    const observer = new ResizeObserver(() => requestAnimationFrame(update));
    observer.observe(node);
    return () => observer.disconnect();
  }, [fillHeight]);

  const filteredCoins = useMemo(() => {
    if (filter === "gainers") return coins.filter((c) => c.change24h > 0);
    if (filter === "losers") return coins.filter((c) => c.change24h < 0);
    return coins;
  }, [coins, filter]);

  const data = useMemo<TreemapNode[]>(
    () =>
      filteredCoins.slice(0, maxTiles).map((coin) => ({
        ...coin,
        // Size by move magnitude so similarly large +/- moves look similarly sized.
        size: Math.max(Math.abs(coin.change24h), 0.2),
      })),
    [filteredCoins, maxTiles],
  );
  const positioned = useMemo<HierarchyRectangularNode<TreemapNode>[]>(() => {
    if (containerWidth <= 0 || data.length === 0) return [];
    const root = hierarchy<{ children: TreemapNode[] }>({ children: data })
      .sum((d: any) => d.size || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));
    treemap<{ children: TreemapNode[] }>()
      .size([containerWidth, chartHeight])
      .paddingInner(2)
      .round(true)(root);
    return root.leaves() as unknown as HierarchyRectangularNode<TreemapNode>[];
  }, [containerWidth, chartHeight, data]);

  return (
    <section
      className={`rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm ${
        /* min-h-0: let flex children shrink; avoids content-sized height fighting the grid row */
        fillHeight ? "flex h-full min-h-0 flex-col max-lg:h-auto" : ""
      }`}
    >
      <h3 className="shrink-0 text-sm font-semibold text-[var(--b70-text)]">Crypto market heatmap</h3>
      <div className="mt-0.5 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[var(--b70-text-muted)]">
          Treemap sized by 24h move magnitude, colored by 24h price change
        </p>
        <div className="inline-flex items-center rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] p-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-900/70">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded px-2 py-1 ${
              filter === "all"
                ? "bg-[var(--b70-border)] text-[var(--b70-text)] dark:bg-slate-700 dark:text-slate-100"
                : "text-[var(--b70-text-muted)] hover:text-[var(--b70-text)]"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("gainers")}
            className={`rounded px-2 py-1 ${
              filter === "gainers"
                ? "bg-emerald-700/70 text-emerald-100"
                : "text-[var(--b70-text-muted)] hover:text-[var(--b70-text)]"
            }`}
          >
            Gainers
          </button>
          <button
            type="button"
            onClick={() => setFilter("losers")}
            className={`rounded px-2 py-1 ${
              filter === "losers"
                ? "bg-rose-700/70 text-rose-100"
                : "text-[var(--b70-text-muted)] hover:text-[var(--b70-text)]"
            }`}
          >
            Losers
          </button>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--b70-text-muted)]">
          No coins in this filter right now.
        </p>
      ) : (
        <div
          ref={containerRef}
          className={`relative mt-3 w-full overflow-hidden rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] dark:border-slate-800 dark:bg-slate-900/50 ${
            fillHeight
              ? /* basis-0 + min-h-0: stable flex slice; SVG absolute must not set this box’s content height */
                "min-h-0 flex-1 basis-0 max-lg:h-[560px] max-lg:flex-none max-lg:basis-auto"
              : "h-[560px]"
          }`}
        >
          {containerWidth > 0 ? (
            <svg
              className={fillHeight ? "pointer-events-auto absolute left-0 top-0 max-lg:static" : ""}
              width={containerWidth}
              height={chartHeight}
              viewBox={`0 0 ${containerWidth} ${chartHeight}`}
            >
              {positioned.map((leaf) => {
                const d = leaf.data;
                if (!isTreemapNode(d)) return null;
                const x = leaf.x0;
                const y = leaf.y0;
                const w = Math.max(0, leaf.x1 - leaf.x0);
                const h = Math.max(0, leaf.y1 - leaf.y0);
                const showPrice = w > 90 && h > 45;
                const showChange = w > 90 && h > 58;
                const showLogo = w > 36 && h > 36 && d.logoUrl;
                const changeTxt = `${d.change24h >= 0 ? "+" : ""}${d.change24h.toFixed(2)}%`;
                const symbolFontSize = Math.max(
                  7,
                  Math.min(12, Math.floor(((w - (showLogo ? 32 : 8)) / Math.max(d.symbol.length, 3)) * 1.8)),
                );
                const textX = showLogo ? x + 28 : x + 4;
                return (
                  <g
                    key={d.slug}
                    onClick={() => router.push(`/coins/${d.slug}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <title>{`${d.name} (${d.symbol})\nPrice: ${formatPrice(d.price)}\n24h: ${changeTxt}\n24h Volume: ${formatMarketCap(d.volume24h)}\nMarket Cap: ${formatMarketCap(d.marketCap)}`}</title>
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={colorForChange(d.change24h)}
                      stroke="#0f172a"
                      strokeWidth={1}
                      rx={2}
                    />
                    {showLogo && d.logoUrl ? (
                      <image
                        href={d.logoUrl || undefined}
                        x={x + 4}
                        y={y + 4}
                        width={20}
                        height={20}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    ) : null}
                    <text
                      x={textX}
                      y={y + 14}
                      fill="#ffffff"
                      fontSize={symbolFontSize}
                      fontWeight={700}
                    >
                      {d.symbol}
                    </text>
                    {showPrice ? (
                      <text x={x + 4} y={y + 29} fill="#e2e8f0" fontSize={11}>
                        {formatPrice(d.price)}
                      </text>
                    ) : null}
                    {showChange ? (
                      <text x={x + 4} y={y + 44} fill="#f8fafc" fontSize={11}>
                        {changeTxt}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              Loading heatmap…
            </div>
          )}
        </div>
      )}
    </section>
  );
}
