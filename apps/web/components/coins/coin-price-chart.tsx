"use client";

import { useCallback, useEffect, useState } from "react";
import { getCoinChartData, type ChartPricePoint } from "@/lib/coins";
import { chartColors } from "@/components/ui/charts/chart-styles";
import { clsx } from "clsx";

export type ChartRange = "24H" | "7D" | "1M" | "3M" | "1Y" | "YTD" | "Max";
export type ChartView = "line" | "candlestick";

/** Derive OHLC from [timestamp, close][] by grouping into buckets. */
function deriveOHLC(
  points: ChartPricePoint[],
  range: ChartRange
): { ts: number; o: number; h: number; l: number; c: number }[] {
  if (!points.length) return [];
  const bucketMs =
    range === "24H"
      ? 60 * 60 * 1000 // 1h
      : range === "7D" || range === "1M"
        ? 24 * 60 * 60 * 1000 // 1d
        : 24 * 60 * 60 * 1000; // 1d for 3M, 1Y, YTD, Max
  const buckets = new Map<number, number[]>();
  for (const [ts, price] of points) {
    const key = Math.floor(ts / bucketMs) * bucketMs;
    const arr = buckets.get(key) ?? [];
    arr.push(price);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ts, prices]) => ({
      ts,
      o: prices[0]!,
      h: Math.max(...prices),
      l: Math.min(...prices),
      c: prices[prices.length - 1]!,
    }));
}

const RANGES: { key: ChartRange; label: string; days: number }[] = [
  { key: "24H", label: "24H", days: 1 },
  { key: "7D", label: "7D", days: 7 },
  { key: "1M", label: "1M", days: 30 },
  { key: "3M", label: "3M", days: 90 },
  { key: "1Y", label: "1Y", days: 365 },
  { key: "YTD", label: "YTD", days: 0 },
  { key: "Max", label: "Max", days: -1 },
];

function getYtdDays(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function formatPrice(price: number): string {
  if (price >= 1e6) return `$${(price / 1e6).toFixed(2)}M`;
  if (price >= 1e3) return `$${(price / 1e3).toFixed(1)}K`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function formatTime(timestamp: number, range: ChartRange): string {
  const d = new Date(timestamp);
  if (range === "24H") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (range === "7D" || range === "1M" || range === "3M") return d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleDateString([], { month: "short", year: "2-digit" });
}

type Props = {
  slug: string;
  className?: string;
};

export function CoinPriceChart({ slug, className }: Props) {
  const [range, setRange] = useState<ChartRange>("7D");
  const [view, setView] = useState<ChartView>("line");
  const [points, setPoints] = useState<ChartPricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const days =
    range === "YTD"
      ? getYtdDays()
      : range === "Max"
        ? 365 * 10
        : RANGES.find((r) => r.key === range)?.days ?? 7;

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
  const ohlc = deriveOHLC(points, range);
  const minPrice =
    view === "candlestick" && ohlc.length
      ? Math.min(...ohlc.map((c) => c.l))
      : Math.min(...prices) || 0;
  const maxPrice =
    view === "candlestick" && ohlc.length
      ? Math.max(...ohlc.map((c) => c.h))
      : Math.max(...prices) || 1;
  const rangeVal = maxPrice - minPrice || 1;
  const padding = { top: 24, right: 58, bottom: 32, left: 16 };
  const width = 600;
  const height = 320;
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

  /** Candlestick bars: x, bodyTop, bodyBottom, bodyHeight, wickHigh, wickLow, isUp, halfW */
  const barCount = ohlc.length;
  const barHalfW = barCount > 0 ? Math.max(2, Math.min(4, chartW / barCount / 2 - 1)) : 4;
  const candles =
    view === "candlestick" && barCount > 0
      ? ohlc.map((c, i) => {
          const x =
            barCount === 1
              ? padding.left + chartW / 2
              : padding.left + (i / (barCount - 1)) * chartW;
          const bodyTop = padding.top + chartH - ((Math.max(c.o, c.c) - minPrice) / rangeVal) * chartH;
          const bodyBottom = padding.top + chartH - ((Math.min(c.o, c.c) - minPrice) / rangeVal) * chartH;
          const wickHigh = padding.top + chartH - ((c.h - minPrice) / rangeVal) * chartH;
          const wickLow = padding.top + chartH - ((c.l - minPrice) / rangeVal) * chartH;
          const bodyHeight = Math.max(1, Math.abs(bodyBottom - bodyTop));
          return {
            x,
            bodyTop,
            bodyBottom,
            bodyHeight,
            wickHigh,
            wickLow,
            candleUp: c.c >= c.o,
            halfW: barHalfW,
          };
        })
      : [];

  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = minPrice + (rangeVal * i) / yTicks;
    return { val: v, y: padding.top + chartH - (chartH * i) / yTicks };
  });

  const xTicks = 4;
  const sourceForX = view === "candlestick" && ohlc.length ? ohlc : points;
  const xLabels = Array.from({ length: xTicks + 1 }, (_, i) => {
    const idx = Math.min(
      Math.floor((i / xTicks) * Math.max(0, sourceForX.length - 1)),
      sourceForX.length - 1
    );
    const item = sourceForX[idx];
    const ts = item
      ? (Array.isArray(item) ? item[0] : (item as { ts: number }).ts)
      : 0;
    return { ts, x: padding.left + (i / xTicks) * chartW };
  });

  const gradientId = `coin-chart-grad-${slug}-${range}`;

  return (
    <section className={clsx("space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">Price chart</p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-full border border-slate-700 bg-slate-800/60 p-0.5">
            <button
              type="button"
              onClick={() => setView("line")}
              className={clsx(
                "rounded-full px-2.5 py-1 text-xs font-semibold transition-all",
                view === "line"
                  ? "bg-slate-600 text-white"
                  : "text-slate-500 hover:text-slate-200"
              )}
            >
              Line
            </button>
            <button
              type="button"
              onClick={() => setView("candlestick")}
              className={clsx(
                "rounded-full px-2.5 py-1 text-xs font-semibold transition-all",
                view === "candlestick"
                  ? "bg-slate-600 text-white"
                  : "text-slate-500 hover:text-slate-200"
              )}
            >
              Candles
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                  range === r.key
                    ? "bg-white/95 text-slate-900 shadow-sm dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-500 hover:bg-slate-700/60 hover:text-slate-200"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && !points.length ? (
        <div className="flex h-72 items-center justify-center text-slate-500">Loading chart…</div>
      ) : points.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-slate-500">No chart data</div>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-72 w-full min-w-[360px] sm:h-80"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={isUp ? chartColors.up : chartColors.down} stopOpacity="0.6" />
                <stop offset="100%" stopColor={isUp ? chartColors.up : chartColors.down} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Grid - horizontal only like CoinGecko */}
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
            {/* Y-axis labels on the right (CoinGecko style) */}
            {yLabels.map((l, i) => (
              <text
                key={i}
                x={width - padding.right + 8}
                y={l.y}
                textAnchor="start"
                dominantBaseline="middle"
                className="fill-[var(--b70-text-muted)] text-xs font-medium"
              >
                {formatPrice(l.val)}
              </text>
            ))}
            {/* X labels */}
            {xLabels.map((l, i) => (
              <text
                key={i}
                x={l.x}
                y={height - 8}
                textAnchor="middle"
                className="fill-[var(--b70-text-muted)] text-xs"
              >
                {formatTime(l.ts, range)}
              </text>
            ))}
            {view === "line" && (
              <>
                <path d={areaD} fill={`url(#${gradientId})`} opacity={0.3} />
                <path
                  d={pathD}
                  fill="none"
                  stroke={isUp ? chartColors.up : chartColors.down}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
            {view === "candlestick" &&
              candles.map((candle, i) => (
                <g key={i}>
                  <line
                    x1={candle.x}
                    y1={candle.wickHigh}
                    x2={candle.x}
                    y2={candle.wickLow}
                    stroke={candle.candleUp ? chartColors.up : chartColors.down}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={candle.x - candle.halfW}
                    y={candle.bodyTop}
                    width={candle.halfW * 2}
                    height={candle.bodyHeight}
                    fill={candle.candleUp ? chartColors.up : chartColors.down}
                    stroke="none"
                  />
                </g>
              ))}
          </svg>
        </div>
      )}
    </section>
  );
}
