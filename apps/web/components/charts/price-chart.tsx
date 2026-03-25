"use client";

import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type SeriesMarker,
  type Time,
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
  /** CoinGecko-style slug (e.g. bitcoin) — enables Block70 pack API (no browser→exchange). */
  coin?: string;
  symbol?: string;
  slug?: string;
  height?: number;
  className?: string;
};

/** Block70 backend timeframes */
type PackTimeframe = "1m" | "5m" | "1h" | "4h" | "1d";

const PACK_TIMEFRAMES: { key: PackTimeframe; label: string }[] = [
  { key: "1m", label: "1M" },
  { key: "5m", label: "5M" },
  { key: "1h", label: "1H" },
  { key: "4h", label: "4H" },
  { key: "1d", label: "1D" },
];

const LEGACY_TIMEFRAMES: { key: ChartTimeframeKey; label: string }[] = [
  { key: "1H", label: "1H" },
  { key: "4H", label: "4H" },
  { key: "1D", label: "1D" },
  { key: "7D", label: "7D" },
];

/** When the Block70 pack misses, fall back to Next route with the matching Binance interval. */
function packTfToLegacy(tf: PackTimeframe): ChartTimeframeKey {
  switch (tf) {
    case "1m":
      return "1M";
    case "5m":
      return "5M";
    case "4h":
      return "4H";
    case "1d":
      return "1D";
    default:
      return "1H";
  }
}

export type ChartMode = "line" | "candle";

type Block70Marker = { time: number; kind: string; label?: string };

type ChartPackPayload = {
  ohlc?: OHLCVPoint[];
  volume?: { time: number; value: number }[];
  indicators?: {
    score?: number | null;
    signal?: string;
    markers?: Block70Marker[];
  };
  meta?: { source?: string; slug?: string };
  error?: string;
};

function signalBadgeClass(signal: string | undefined): string {
  const s = (signal || "").toLowerCase();
  if (s.includes("strong") && s.includes("buy")) return "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40";
  if (s.includes("buy")) return "bg-green-500/15 text-green-300 ring-green-500/35";
  if (s.includes("strong") && s.includes("sell")) return "bg-red-600/25 text-red-300 ring-red-500/45";
  if (s.includes("sell")) return "bg-rose-500/15 text-rose-300 ring-rose-500/35";
  return "bg-slate-600/30 text-slate-300 ring-slate-500/40";
}

function markersToPluginShape(markers: Block70Marker[]): SeriesMarker<Time>[] {
  const out: SeriesMarker<Time>[] = [];
  for (const m of markers) {
    const t = m.time as Time;
    if (m.kind === "buy") {
      out.push({
        time: t,
        position: "belowBar",
        color: "#34d399",
        shape: "arrowUp",
        text: m.label || "Buy",
      });
    } else if (m.kind === "sell") {
      out.push({
        time: t,
        position: "aboveBar",
        color: "#f87171",
        shape: "arrowDown",
        text: m.label || "Sell",
      });
    }
  }
  return out;
}

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
      c.close >= c.open ? "rgba(0, 255, 163, 0.35)" : "rgba(255, 107, 107, 0.35)",
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
  const block70Slug = (coin ?? slugProp ?? "").trim();
  const sym = (symbol ?? "").trim().toUpperCase();
  const usePackApi = Boolean(block70Slug);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<ISeriesApi<"Line"> | ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const ohlcvRef = useRef<OHLCVPoint[]>([]);

  const [packTf, setPackTf] = useState<PackTimeframe>("1h");
  const [legacyTf, setLegacyTf] = useState<ChartTimeframeKey>("1D");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [ohlcv, setOhlcv] = useState<OHLCVPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [block70Score, setBlock70Score] = useState<number | null>(null);
  const [block70Signal, setBlock70Signal] = useState<string | null>(null);
  const [overlayMarkers, setOverlayMarkers] = useState<Block70Marker[]>([]);

  const fetchData = useCallback(async () => {
    if (usePackApi) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/chart?${new URLSearchParams({ coin: block70Slug, timeframe: packTf }).toString()}`,
          { cache: "default" }
        );
        const data = (await res.json()) as ChartPackPayload;
        if (!res.ok) {
          setError(data.error || `HTTP ${res.status}`);
          setOhlcv([]);
          setSource(null);
          setBlock70Score(null);
          setBlock70Signal(null);
          setOverlayMarkers([]);
          return;
        }
        let bars = data.ohlc ?? [];
        let srcLine = data.meta?.source ? `Block70 · ${data.meta.source}` : "Block70 pack";
        let ind = data.indicators;

        if (!bars.length && sym) {
          const legTf = packTfToLegacy(packTf);
          const sp = new URLSearchParams({ timeframe: legTf });
          sp.set("slug", block70Slug);
          const res2 = await fetch(`/api/charts/${encodeURIComponent(sym)}?${sp}`, {
            cache: "default",
          });
          const data2 = (await res2.json()) as {
            ohlcv?: OHLCVPoint[];
            error?: string | null;
            source?: string | null;
          };
          if (res2.ok && !data2.error && (data2.ohlcv?.length ?? 0) > 0) {
            bars = data2.ohlcv ?? [];
            srcLine = data2.source ? `Fallback · ${data2.source}` : "Fallback market data";
            ind = undefined;
          }
        }

        if (!bars.length) {
          ind = undefined;
        }

        setOhlcv(bars);
        setSource(bars.length ? srcLine : data.meta?.source === "none" ? "Block70 · none" : srcLine);
        if (ind) {
          setBlock70Score(typeof ind.score === "number" ? ind.score : null);
          setBlock70Signal(ind.signal ?? null);
          setOverlayMarkers(Array.isArray(ind.markers) ? ind.markers : []);
        } else {
          setBlock70Score(null);
          setBlock70Signal(null);
          setOverlayMarkers([]);
        }
        if (!bars.length) {
          setError("No OHLCV data available for this token on current markets.");
        } else {
          setError(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load chart");
        setOhlcv([]);
        setSource(null);
        setBlock70Score(null);
        setBlock70Signal(null);
        setOverlayMarkers([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!sym) return;
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({ timeframe: legacyTf });
      if (block70Slug) sp.set("slug", block70Slug);
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
        setBlock70Score(null);
        setBlock70Signal(null);
        setOverlayMarkers([]);
        return;
      }
      if (data.error && !(data.ohlcv?.length)) {
        setError(data.error);
        setOhlcv([]);
        setSource(null);
        setBlock70Score(null);
        setBlock70Signal(null);
        setOverlayMarkers([]);
        return;
      }
      setOhlcv(data.ohlcv ?? []);
      setSource(data.source ?? null);
      setBlock70Score(null);
      setBlock70Signal(null);
      setOverlayMarkers([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chart");
      setOhlcv([]);
      setSource(null);
      setBlock70Score(null);
      setBlock70Signal(null);
      setOverlayMarkers([]);
    } finally {
      setLoading(false);
    }
  }, [usePackApi, block70Slug, packTf, sym, legacyTf]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    ohlcvRef.current = ohlcv;
  }, [ohlcv]);

  const chartMountKey = usePackApi ? `pack:${block70Slug}` : `legacy:${sym}`;
  const chartDepKey = usePackApi ? block70Slug : sym;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !chartDepKey) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        attributionLogo: false,
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

    const mk = createSeriesMarkers(main, []);
    markersRef.current = mk;

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
      markersRef.current = null;
    };
  }, [chartMountKey, height, chartMode]);

  useEffect(() => {
    const chart = chartRef.current;
    const main = mainRef.current;
    const vol = volumeRef.current;
    if (!chart || !main || !vol) return;
    applyOhlcvToSeries(chart, main, vol, ohlcv, chartMode);
  }, [ohlcv, chartMode]);

  useEffect(() => {
    const mk = markersRef.current;
    if (!mk) return;
    mk.setMarkers(markersToPluginShape(overlayMarkers));
  }, [overlayMarkers, ohlcv]);

  if (!chartDepKey) {
    return (
      <p className={clsx("rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-500", className)}>
        Chart unavailable (missing coin or symbol).
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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Price chart
            </p>
            {usePackApi && block70Signal ? (
              <span
                className={clsx(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1",
                  signalBadgeClass(block70Signal)
                )}
              >
                {block70Signal}
              </span>
            ) : null}
          </div>
          {usePackApi && block70Score != null ? (
            <p className="text-lg font-semibold tabular-nums text-white">
              Block70 score{" "}
              <span className="text-emerald-400">{block70Score.toFixed(1)}</span>
              <span className="text-xs font-normal text-slate-500"> / 100</span>
            </p>
          ) : null}
          {source && !loading ? (
            <p className="text-[10px] text-slate-500">Data · {source}</p>
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
            {usePackApi
              ? PACK_TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.key}
                    type="button"
                    onClick={() => setPackTf(tf.key)}
                    disabled={loading}
                    className={clsx(
                      "rounded-full px-2.5 py-1 text-xs font-semibold transition",
                      packTf === tf.key
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-500 hover:bg-slate-800/80 hover:text-slate-200"
                    )}
                  >
                    {tf.label}
                  </button>
                ))
              : LEGACY_TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.key}
                    type="button"
                    onClick={() => setLegacyTf(tf.key)}
                    disabled={loading}
                    className={clsx(
                      "rounded-full px-2.5 py-1 text-xs font-semibold transition",
                      legacyTf === tf.key
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
        {usePackApi
          ? "OHLCV and Block70 signals are served from the Block70 API (cached). Not investment advice."
          : "Prices from public market APIs. Not investment advice."}
      </p>
    </section>
  );
}
