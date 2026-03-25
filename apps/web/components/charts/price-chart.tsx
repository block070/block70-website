"use client";

import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import { useCallback, useEffect, useRef, useState } from "react";
import { chartColors } from "@/components/ui/charts/chart-styles";
import type { ChartTimeframeKey } from "@/lib/ohlcv-providers";
import { clsx } from "clsx";

export type OHLCVPoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type PriceChartProps = {
  /** CoinGecko id / URL slug (e.g. bitcoin) — improves fallback data */
  coin?: string;
  symbol?: string;
  slug?: string;
  height?: number;
  className?: string;
};

const TIMEFRAMES: { key: ChartTimeframeKey; label: string }[] = [
  { key: "1H", label: "1H" },
  { key: "4H", label: "4H" },
  { key: "1D", label: "1D" },
  { key: "7D", label: "7D" },
];

export type ChartMode = "line" | "candle";

function applyOhlcvToSeries(
  chart: IChartApi,
  main: ISeriesApi<"Line"> | ISeriesApi<"Candlestick">,
  volume: ISeriesApi<"Histogram">,
  ohlcv: OHLCVPoint[],
  mode: ChartMode
) {
  if (!ohlcv.length) {
    if (mode === "line") (main as ISeriesApi<"Line">).setData([]);
    else (main as ISeriesApi<"Candlestick">).setData([]);
    volume.setData([]);
    return;
  }

  const volData: HistogramData[] = ohlcv.map((c) => ({
    time: c.time as UTCTimestamp,
    value: c.volume,
    color:
      c.close >= c.open
        ? "rgba(0, 255, 163, 0.35)"
        : "rgba(255, 107, 107, 0.35)",
  }));
  volume.setData(volData);

  if (mode === "line") {
    const lineData: LineData[] = ohlcv.map((c) => ({
      time: c.time as UTCTimestamp,
      value: c.close,
    }));
    (main as ISeriesApi<"Line">).setData(lineData);
  } else {
    const candleData: CandlestickData[] = ohlcv.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    (main as ISeriesApi<"Candlestick">).setData(candleData);
  }
  chart.timeScale().fitContent();
}

export function PriceChart({
  coin,
  symbol,
  slug: slugProp,
  height = 400,
  className,
}: PriceChartProps) {
  const slug = (coin ?? slugProp ?? "").trim();
  const sym = (symbol ?? "").trim().toUpperCase();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<ISeriesApi<"Line"> | ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ohlcvRef = useRef<OHLCVPoint[]>([]);

  const [timeframe, setTimeframe] = useState<ChartTimeframeKey>("1D");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [ohlcv, setOhlcv] = useState<OHLCVPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!sym) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({ timeframe });
      if (slug) sp.set("slug", slug);
      const res = await fetch(`/api/charts/${encodeURIComponent(sym)}?${sp}`, {
        cache: "default",
      });
      const data = (await res.json()) as {
        ohlcv?: OHLCVPoint[];
        error?: string | null;
        source?: string | null;
      };
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setOhlcv([]);
        setSource(null);
        return;
      }
      if (data.error && !(data.ohlcv?.length)) {
        setError(data.error);
        setOhlcv([]);
        setSource(null);
        return;
      }
      setOhlcv(data.ohlcv ?? []);
      setSource(data.source ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chart");
      setOhlcv([]);
      setSource(null);
    } finally {
      setLoading(false);
    }
  }, [sym, slug, timeframe]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    ohlcvRef.current = ohlcv;
  }, [ohlcv]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !sym) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        attributionLogo: true,
      },
      width: el.clientWidth,
      height,
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.08)" },
        horzLines: { color: "rgba(148, 163, 184, 0.08)" },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "rgba(148, 163, 184, 0.4)",
          width: 1,
          labelBackgroundColor: "#334155",
        },
        horzLine: {
          color: "rgba(148, 163, 184, 0.4)",
          width: 1,
          labelBackgroundColor: "#334155",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(51, 65, 85, 0.6)",
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "rgba(51, 65, 85, 0.6)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: true, horzTouchDrag: true },
    });

    chartRef.current = chart;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: chartColors.volume,
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volumeRef.current = volumeSeries;

    const main =
      chartMode === "line"
        ? chart.addSeries(LineSeries, {
            color: chartColors.up,
            lineWidth: 2,
            crosshairMarkerVisible: true,
            lastValueVisible: true,
            priceLineVisible: true,
          })
        : chart.addSeries(CandlestickSeries, {
            upColor: chartColors.up,
            downColor: chartColors.down,
            borderVisible: false,
            wickUpColor: chartColors.up,
            wickDownColor: chartColors.down,
          });
    mainRef.current = main;

    applyOhlcvToSeries(chart, main, volumeSeries, ohlcvRef.current, chartMode);

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
        height,
      });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      mainRef.current = null;
      volumeRef.current = null;
    };
  }, [sym, height, chartMode]);

  useEffect(() => {
    const chart = chartRef.current;
    const main = mainRef.current;
    const vol = volumeRef.current;
    if (!chart || !main || !vol) return;
    applyOhlcvToSeries(chart, main, vol, ohlcv, chartMode);
  }, [ohlcv, chartMode]);

  if (!sym) {
    return (
      <p className={clsx("rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-500", className)}>
        Chart unavailable (missing symbol).
      </p>
    );
  }

  return (
    <section
      className={clsx(
        "space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Price chart
          </p>
          {source && !loading ? (
            <p className="mt-0.5 text-[10px] text-slate-500">Data · {source}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-slate-700 bg-slate-800/60 p-0.5">
            <button
              type="button"
              onClick={() => setChartMode("line")}
              className={clsx(
                "rounded-full px-2.5 py-1 text-xs font-semibold transition",
                chartMode === "line"
                  ? "bg-slate-600 text-white"
                  : "text-slate-500 hover:text-slate-200"
              )}
            >
              Line
            </button>
            <button
              type="button"
              onClick={() => setChartMode("candle")}
              className={clsx(
                "rounded-full px-2.5 py-1 text-xs font-semibold transition",
                chartMode === "candle"
                  ? "bg-slate-600 text-white"
                  : "text-slate-500 hover:text-slate-200"
              )}
            >
              Candles
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.key}
                type="button"
                onClick={() => setTimeframe(tf.key)}
                disabled={loading}
                className={clsx(
                  "rounded-full px-2.5 py-1 text-xs font-semibold transition",
                  timeframe === tf.key
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:bg-slate-800/80 hover:text-slate-200"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-lg border border-slate-800/80 bg-slate-950/40">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col justify-end gap-2 p-4">
            <div className="h-32 w-full animate-pulse rounded bg-slate-800/60" />
            <div className="h-10 w-full animate-pulse rounded bg-slate-800/40" />
          </div>
        )}
        {error && !ohlcv.length && !loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/90 px-4 text-center text-sm text-rose-400">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void fetchData()}
              className="ml-3 text-xs text-sky-400 underline hover:text-sky-300"
            >
              Retry
            </button>
          </div>
        ) : null}
        <div ref={containerRef} style={{ height: `${height}px` }} className="w-full min-h-[200px]" />
      </div>

      <p className="text-[10px] text-slate-500">
        Prices from public market APIs (Binance → Coinbase → CoinGecko). Not investment advice.
      </p>
    </section>
  );
}
