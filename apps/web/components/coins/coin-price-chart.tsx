"use client";

import { useCallback, useEffect, useState } from "react";
import { getCoinChartData, type ChartPricePoint } from "@/lib/coins";
import { chartColors } from "@/components/ui/charts/chart-styles";
import { clsx } from "clsx";

export type ChartRange = "24H" | "7D" | "1M" | "3M" | "1Y" | "YTD";

const RANGES: { key: ChartRange; label: string; days: number }[] = [
  { key: "24H", label: "24H", days: 1 },
  { key: "7D", label: "7D", days: 7 },
  { key: "1M", label: "1M", days: 30 },
  { key: "3M", label: "3M", days: 90 },
  { key: "1Y", label: "1Y", days: 365 },
  { key: "YTD", label: "YTD", days: 0 },
];

function getYtdDays(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function formatPrice(price: number): string {
  if (price >= 1e6) return `$${(price / 1e6).toFixed(2)}M`;
  if (price >= 1e3) return `$${(price / 1e3).toFixed(2)}K`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function formatTime(timestamp: number, range: ChartRange): string {
  const d = new Date(timestamp);
  if (range === "24H") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (range === "7D" || range === "1M") return d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleDateString([], { month: "short", year: "2-digit" });
}

type Props = {
  slug: string;
  className?: string;
};

export function CoinPriceChart({ slug, className }: Props) {
  const [range, setRange] = useState<ChartRange>("7D");
  const [points, setPoints] = useState<ChartPricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const days = range === "YTD" ? getYtdDays() : RANGES.find((r) => r.key === range)?.days ?? 7;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCoinChartData(slug, days);
      setPoints(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chart");
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [slug, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error && !points.length) {
    return (
      <section className={clsx("rounded-xl border border-slate-800 bg-slate-900/60 p-4", className)}>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Price chart</p>
        <p className="mt-4 text-sm text-rose-400">{error}</p>
      </section>
    );
  }

  const prices = points.map((p) => p[1]);
  const minPrice = Math.min(...prices) || 0;
  const maxPrice = Math.max(...prices) || 1;
  const rangeVal = maxPrice - minPrice || 1;
  const padding = { top: 20, right: 12, bottom: 24, left: 52 };
  const width = 400;
  const height = 200;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const pathPoints = points.map((p, i) => {
    const x = padding.left + (i / (points.length - 1 || 1)) * chartW;
    const y = padding.top + chartH - ((p[1] - minPrice) / rangeVal) * chartH;
    return `${i === 0 ? "M" : "L"} ${x},${y}`;
  });
  const pathD = pathPoints.join(" ");
  const areaD = `${pathD} L ${padding.left + chartW},${padding.top + chartH} L ${padding.left},${padding.top + chartH} Z`;
  const isUp = prices[prices.length - 1] >= prices[0];

  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = minPrice + (rangeVal * i) / yTicks;
    return { val: v, y: padding.top + chartH - (chartH * i) / yTicks };
  });

  const xTicks = 4;
  const xLabels = Array.from({ length: xTicks + 1 }, (_, i) => {
    const idx = Math.floor((i / xTicks) * (points.length - 1));
    const p = points[Math.min(idx, points.length - 1)];
    return p ? { ts: p[0], x: padding.left + (i / xTicks) * chartW } : null;
  }).filter(Boolean) as { ts: number; x: number }[];

  const gradientId = `coin-chart-grad-${slug}-${range}`;

  return (
    <section className={clsx("space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Price chart</p>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={clsx(
                "rounded px-2 py-1 text-[11px] font-medium transition-colors",
                range === r.key
                  ? "bg-crypto-blue/30 text-crypto-blue"
                  : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !points.length ? (
        <div className="flex h-40 items-center justify-center text-slate-500">Loading chart…</div>
      ) : points.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-slate-500">No chart data</div>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-40 w-full min-w-[320px]"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={isUp ? chartColors.up : chartColors.down} stopOpacity="0.5" />
                <stop offset="100%" stopColor={isUp ? chartColors.up : chartColors.down} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Grid */}
            {yLabels.map((l, i) => (
              <line
                key={i}
                x1={padding.left}
                y1={l.y}
                x2={padding.left + chartW}
                y2={l.y}
                stroke="var(--b70-border)"
                strokeWidth="0.5"
              />
            ))}
            {xLabels.map((l, i) => (
              <line
                key={i}
                x1={l.x}
                y1={padding.top}
                x2={l.x}
                y2={padding.top + chartH}
                stroke="var(--b70-border)"
                strokeWidth="0.5"
              />
            ))}
            {/* Y labels */}
            {yLabels.map((l, i) => (
              <text
                key={i}
                x={padding.left - 6}
                y={l.y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-[var(--b70-text-muted)] text-[10px]"
              >
                {formatPrice(l.val)}
              </text>
            ))}
            {/* X labels */}
            {xLabels.map((l, i) => (
              <text
                key={i}
                x={l.x}
                y={height - 6}
                textAnchor="middle"
                className="fill-[var(--b70-text-muted)] text-[10px]"
              >
                {formatTime(l.ts, range)}
              </text>
            ))}
            <path d={areaD} fill={`url(#${gradientId})`} opacity={0.25} />
            <path
              d={pathD}
              fill="none"
              stroke={isUp ? chartColors.up : chartColors.down}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      )}
    </section>
  );
}
