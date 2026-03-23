"use client";

import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type UTCTimestamp,
} from "lightweight-charts";
import { useCallback, useEffect, useRef, useState } from "react";
import { chartColors } from "@/components/ui/charts/chart-styles";
import { clsx } from "clsx";

export type OHLCVPoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartTimeframe = "1H" | "4H" | "1D" | "1W";

const TIMEFRAMES: { key: ChartTimeframe; label: string; api: string }[] = [
  { key: "1H", label: "1H", api: "1h" },
  { key: "4H", label: "4H", api: "4h" },
  { key: "1D", label: "1D", api: "1d" },
  { key: "1W", label: "1W", api: "1w" },
];

type Props = {
  symbol: string;
  slug?: string;
  height?: number;
  className?: string;
};

export function PriceChart({ symbol, slug, height = 400, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1D");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiSymbol = symbol?.toUpperCase() || slug || "";
  const tfConfig = TIMEFRAMES.find((t) => t.key === timeframe)!;

  const fetchData = useCallback(async () => {
    if (!apiSymbol) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/charts/${encodeURIComponent(apiSymbol)}?timeframe=${tfConfig.api}&limit=200`;
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as { ohlcv?: OHLCVPoint[] };
      const ohlcv = data.ohlcv ?? [];
      return ohlcv;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chart");
      return [];
    } finally {
      setLoading(false);
    }
  }, [apiSymbol, tfConfig.api]);

  useEffect(() => {
    if (!containerRef.current || !apiSymbol) return;

    const isDark = true;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "var(--b70-text-muted)",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.08)" },
        horzLines: { color: "rgba(148, 163, 184, 0.08)" },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "var(--b70-border)",
          width: 1,
          labelBackgroundColor: chartColors.up,
        },
        horzLine: {
          color: "var(--b70-border)",
          width: 1,
          labelBackgroundColor: chartColors.up,
        },
      },
      rightPriceScale: {
        borderColor: "var(--b70-border)",
        scaleMargins: { top: 0.1, bottom: 0.25 },
        entireTextOnly: true,
      },
      timeScale: {
        borderColor: "var(--b70-border)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: true, horzTouchDrag: true },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: chartColors.up,
      downColor: chartColors.down,
      borderVisible: false,
      wickUpColor: chartColors.up,
      wickDownColor: chartColors.down,
    });
    candlestickRef.current = candlestickSeries as ISeriesApi<"Candlestick">;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: chartColors.volume,
      priceFormat: { type: "volume" },
      priceScaleId: "",
    }) as ISeriesApi<"Histogram">;
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
      visible: false,
    });
    volumeRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candlestickRef.current = null;
      volumeRef.current = null;
    };
  }, [apiSymbol]);

  useEffect(() => {
    fetchData().then((ohlcv) => {
      if (!candlestickRef.current || !volumeRef.current) return;
      if (!ohlcv?.length) {
        candlestickRef.current.setData([]);
        volumeRef.current.setData([]);
        return;
      }

      const candleData: CandlestickData[] = ohlcv.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      const volData: HistogramData[] = ohlcv.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(0, 255, 163, 0.4)" : "rgba(255, 107, 107, 0.4)",
      }));

      candlestickRef.current.setData(candleData);
      volumeRef.current.setData(volData);
      chartRef.current?.timeScale().fitContent();
    });
  }, [fetchData]);

  return (
    <section
      className={clsx(
        "space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Price chart
        </p>
        <div className="flex gap-1.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.key}
              type="button"
              onClick={() => setTimeframe(tf.key)}
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                timeframe === tf.key
                  ? "bg-white/95 text-slate-900 dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-700/60 hover:text-slate-200"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative" style={{ height: `${height}px` }}>
        {(loading || error) && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80 text-slate-500"
            style={{ height: `${height}px` }}
          >
            {error ? <span className="text-rose-400">{error}</span> : "Loading chart…"}
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </section>
  );
}
