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
  { key: "1m", label: "1m" },
  { key: "5m", label: "5m" },
  { key: "1h", label: "1h" },
  { key: "4h", label: "4h" },
  { key: "1d", label: "1d" },
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

type MacdPackPoint = {
  time: number;
  line?: number | null;
  signal?: number | null;
  histogram?: number | null;
};

type ChartPackPayload = {
  ohlc?: OHLCVPoint[];
  volume?: { time: number; value: number }[];
  indicators?: {
    score?: number | null;
    signal?: string;
    rsi?: { time: number; value: number }[];
    macd?: MacdPackPoint[];
    ma50?: { time: number; value: number }[];
    ma200?: { time: number; value: number }[];
    volume_trend?: number | null;
    momentum?: number | null;
  };
  meta?: { source?: string; slug?: string };
  error?: string;
};

type ChartSeriesBundle = {
  chart: IChartApi;
  main: ISeriesApi<"Line"> | ISeriesApi<"Candlestick">;
  volume: ISeriesApi<"Histogram">;
  ma50?: ISeriesApi<"Line">;
  ma200?: ISeriesApi<"Line">;
  rsi?: ISeriesApi<"Line">;
  macdHist?: ISeriesApi<"Histogram">;
  macdLine?: ISeriesApi<"Line">;
  macdSig?: ISeriesApi<"Line">;
};

function signalBadgeClass(signal: string | undefined): string {
  const s = (signal || "").toLowerCase();
  if (s.includes("strong") && s.includes("buy")) return "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40";
  if (s.includes("buy")) return "bg-green-500/15 text-green-300 ring-green-500/35";
  if (s.includes("strong") && s.includes("sell")) return "bg-red-600/25 text-red-300 ring-red-500/45";
  if (s.includes("sell")) return "bg-rose-500/15 text-rose-300 ring-rose-500/35";
  return "bg-slate-600/30 text-slate-300 ring-slate-500/40";
}

function toLineData(pts: { time: number; value: number }[]): LineData[] {
  return pts.map((p) => ({ time: p.time as UTCTimestamp, value: p.value }));
}

function macdHistogramData(pts: MacdPackPoint[] | undefined): HistogramData[] {
  if (!pts?.length) return [];
  return pts.map((p) => {
    const v = typeof p.histogram === "number" ? p.histogram : 0;
    return {
      time: p.time as UTCTimestamp,
      value: v,
      color: v >= 0 ? "rgba(0, 255, 163, 0.45)" : "rgba(255, 107, 107, 0.45)",
    };
  });
}

function macdComponentLine(pts: MacdPackPoint[] | undefined, key: "line" | "signal"): LineData[] {
  if (!pts?.length) return [];
  const out: LineData[] = [];
  for (const p of pts) {
    const v = p[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      out.push({ time: p.time as UTCTimestamp, value: v });
    }
  }
  return out;
}

function applyOhlcvToSeries(
  chart: IChartApi,
  main: ISeriesApi<"Line"> | ISeriesApi<"Candlestick">,
  volume: ISeriesApi<"Histogram">,
  ohlcv: OHLCVPoint[],
  mode: ChartMode,
  packTimeframe: PackTimeframe | null
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

  const n = ohlcv.length;
  if (packTimeframe === "1m" && n > 90) {
    chart.timeScale().setVisibleLogicalRange({ from: n - 90 - 0.5, to: n - 0.5 });
  } else if (packTimeframe === "5m" && n > 72) {
    chart.timeScale().setVisibleLogicalRange({ from: n - 72 - 0.5, to: n - 0.5 });
  } else {
    chart.timeScale().fitContent();
  }
}

function applyIndicatorSeries(b: ChartSeriesBundle, ind: ChartPackPayload["indicators"] | null | undefined) {
  if (b.ma50) {
    b.ma50.setData(ind?.ma50?.length ? toLineData(ind.ma50) : []);
  }
  if (b.ma200) {
    b.ma200.setData(ind?.ma200?.length ? toLineData(ind.ma200) : []);
  }
  if (b.rsi) {
    b.rsi.setData(ind?.rsi?.length ? toLineData(ind.rsi) : []);
  }
  if (b.macdHist) {
    b.macdHist.setData(macdHistogramData(ind?.macd));
  }
  if (b.macdLine) {
    b.macdLine.setData(macdComponentLine(ind?.macd, "line"));
  }
  if (b.macdSig) {
    b.macdSig.setData(macdComponentLine(ind?.macd, "signal"));
  }
}

/** Dedicated pane heights so MACD/RSI are readable (main price uses `height` prop). */
const AUX_MACD_H = 168;
const AUX_RSI_H = 140;

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
  const bundleRef = useRef<ChartSeriesBundle | null>(null);
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
  const [indPack, setIndPack] = useState<ChartPackPayload["indicators"] | null>(null);

  const [showMa50, setShowMa50] = useState(true);
  const [showMa200, setShowMa200] = useState(true);
  const [showRsi, setShowRsi] = useState(false);
  const [showMacd, setShowMacd] = useState(false);

  const clearInd = useCallback(() => {
    setIndPack(null);
    setBlock70Score(null);
    setBlock70Signal(null);
  }, []);

  const fetchData = useCallback(async () => {
    if (usePackApi) {
      setLoading(true);
      setError(null);
      try {
        const chartUrl = `/api/chart?${new URLSearchParams({ coin: block70Slug, timeframe: packTf }).toString()}`;
        const fetchPack = () =>
          fetch(chartUrl, { cache: "default", signal: AbortSignal.timeout(20_000) });
        let res = await fetchPack();
        if (!res.ok && res.status >= 500) {
          await new Promise((r) => setTimeout(r, 400));
          res = await fetchPack();
        }
        const data = (await res.json()) as ChartPackPayload;
        if (!res.ok) {
          setError(data.error || `HTTP ${res.status}`);
          setOhlcv([]);
          setSource(null);
          clearInd();
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
            signal: AbortSignal.timeout(18_000),
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
          setIndPack(ind);
        } else {
          clearInd();
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
        clearInd();
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
        clearInd();
        return;
      }
      if (data.error && !(data.ohlcv?.length)) {
        setError(data.error);
        setOhlcv([]);
        setSource(null);
        clearInd();
        return;
      }
      setOhlcv(data.ohlcv ?? []);
      setSource(data.source ?? null);
      clearInd();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chart");
      setOhlcv([]);
      setSource(null);
      clearInd();
    } finally {
      setLoading(false);
    }
  }, [usePackApi, block70Slug, packTf, sym, legacyTf, clearInd]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    ohlcvRef.current = ohlcv;
  }, [ohlcv]);

  const chartMountKey = usePackApi ? `pack:${block70Slug}` : `legacy:${sym}`;
  const chartDepKey = usePackApi ? block70Slug : sym;

  const layoutKey = `${showMa50}-${showMa200}-${showRsi}-${showMacd}`;
  const auxMacd = showMacd ? AUX_MACD_H : 0;
  const auxRsi = showRsi ? AUX_RSI_H : 0;
  const mainChartH = height;
  const totalChartH = mainChartH + auxMacd + auxRsi;

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
      height: totalChartH,
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
        enableConflation: false,
        rightOffset: 2,
      },
      handleScroll: { vertTouchDrag: true, horzTouchDrag: true },
    });

    chartRef.current = chart;
    const p0 = chart.panes()[0];
    p0.setHeight(mainChartH);

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        color: chartColors.volume,
        priceFormat: { type: "volume" },
        priceScaleId: "",
      },
      0
    );
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const main =
      chartMode === "line"
        ? chart.addSeries(
            LineSeries,
            {
              color: chartColors.up,
              lineWidth: 2,
              crosshairMarkerVisible: true,
              lastValueVisible: true,
              priceLineVisible: true,
            },
            0
          )
        : chart.addSeries(
            CandlestickSeries,
            {
              upColor: chartColors.up,
              downColor: chartColors.down,
              borderVisible: false,
              wickUpColor: chartColors.up,
              wickDownColor: chartColors.down,
            },
            0
          );

    let ma50: ISeriesApi<"Line"> | undefined;
    let ma200: ISeriesApi<"Line"> | undefined;
    if (showMa50) {
      ma50 = chart.addSeries(
        LineSeries,
        {
          color: "#38bdf8",
          lineWidth: 1,
          lastValueVisible: true,
          priceLineVisible: false,
        },
        0
      );
    }
    if (showMa200) {
      ma200 = chart.addSeries(
        LineSeries,
        {
          color: "#c084fc",
          lineWidth: 1,
          lastValueVisible: true,
          priceLineVisible: false,
        },
        0
      );
    }

    let macdHist: ISeriesApi<"Histogram"> | undefined;
    let macdLine: ISeriesApi<"Line"> | undefined;
    let macdSig: ISeriesApi<"Line"> | undefined;
    if (showMacd) {
      chart.addPane(false);
      const pi = chart.panes().length - 1;
      chart.panes()[pi].setHeight(auxMacd);
      macdHist = chart.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
          priceScaleId: "macd",
          priceLineVisible: false,
          lastValueVisible: true,
        },
        pi
      );
      macdHist.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0.05 } });
      macdLine = chart.addSeries(
        LineSeries,
        {
          color: "#38bdf8",
          lineWidth: 1,
          priceScaleId: "macd",
          priceLineVisible: false,
          lastValueVisible: true,
        },
        pi
      );
      macdSig = chart.addSeries(
        LineSeries,
        {
          color: "#e879f9",
          lineWidth: 1,
          priceScaleId: "macd",
          priceLineVisible: false,
          lastValueVisible: true,
        },
        pi
      );
    }

    let rsiLine: ISeriesApi<"Line"> | undefined;
    if (showRsi) {
      chart.addPane(false);
      const pi = chart.panes().length - 1;
      chart.panes()[pi].setHeight(auxRsi);
      rsiLine = chart.addSeries(
        LineSeries,
        {
          color: "#fbbf24",
          lineWidth: 1,
          priceScaleId: "rsi",
          priceLineVisible: false,
          lastValueVisible: true,
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: 0, maxValue: 100 },
            margins: { above: 8, below: 8 },
          }),
        },
        pi
      );
      rsiLine.priceScale().applyOptions({
        scaleMargins: { top: 0.15, bottom: 0.05 },
      });
    }

    const bundle: ChartSeriesBundle = {
      chart,
      main,
      volume: volumeSeries,
      ma50,
      ma200,
      rsi: rsiLine,
      macdHist,
      macdLine,
      macdSig,
    };
    bundleRef.current = bundle;

    applyOhlcvToSeries(
      chart,
      main,
      volumeSeries,
      ohlcvRef.current,
      chartMode,
      usePackApi ? packTf : null
    );

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      const w = containerRef.current.clientWidth;
      chartRef.current.applyOptions({ width: w, height: totalChartH });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      bundleRef.current = null;
    };
  }, [
    chartMountKey,
    chartDepKey,
    height,
    chartMode,
    layoutKey,
    mainChartH,
    totalChartH,
    auxMacd,
    auxRsi,
    packTf,
    usePackApi,
    showMa50,
    showMa200,
    showRsi,
    showMacd,
  ]);

  useEffect(() => {
    const b = bundleRef.current;
    if (!b) return;
    applyOhlcvToSeries(b.chart, b.main, b.volume, ohlcv, chartMode, usePackApi ? packTf : null);
  }, [ohlcv, chartMode, packTf, usePackApi]);

  useEffect(() => {
    const b = bundleRef.current;
    if (!b) return;
    applyIndicatorSeries(b, indPack);
  }, [
    indPack,
    layoutKey,
    chartMountKey,
    chartDepKey,
    height,
    chartMode,
    packTf,
    usePackApi,
  ]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !usePackApi) return;
    const fine = packTf === "1m" || packTf === "5m";
    chart.timeScale().applyOptions({
      secondsVisible: fine,
    });
  }, [packTf, usePackApi]);

  if (!chartDepKey) {
    return (
      <p className={clsx("rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-500", className)}>
        Chart unavailable (missing coin or symbol).
      </p>
    );
  }

  const fmtPct = (x: number) =>
    `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}%`;

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
          {usePackApi && indPack && (indPack.volume_trend != null || indPack.momentum != null) ? (
            <p className="flex flex-wrap gap-x-4 text-[11px] text-slate-400">
              {typeof indPack.volume_trend === "number" ? (
                <span>
                  Volume trend:{" "}
                  <span className="font-semibold tabular-nums text-slate-200">
                    {indPack.volume_trend.toFixed(2)}×
                  </span>{" "}
                  <span className="text-slate-500">(10 / 10 bar)</span>
                </span>
              ) : null}
              {typeof indPack.momentum === "number" ? (
                <span>
                  Momentum (7-bar):{" "}
                  <span className="font-semibold tabular-nums text-slate-200">
                    {fmtPct(indPack.momentum)}
                  </span>
                </span>
              ) : null}
            </p>
          ) : null}
          {source && !loading ? (
            <p className="text-[10px] text-slate-500">Data · {source}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
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
          {usePackApi ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              <IndicatorToggle label="MA 50" active={showMa50} onToggle={() => setShowMa50((v) => !v)} />
              <IndicatorToggle label="MA 200" active={showMa200} onToggle={() => setShowMa200((v) => !v)} />
              <IndicatorToggle label="RSI" active={showRsi} onToggle={() => setShowRsi((v) => !v)} />
              <IndicatorToggle label="MACD" active={showMacd} onToggle={() => setShowMacd((v) => !v)} />
            </div>
          ) : null}
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
        <div
          ref={containerRef}
          style={{ height: `${totalChartH}px` }}
          className="w-full min-h-[200px]"
        />
      </div>

      <p className="text-[10px] text-slate-500">
        {usePackApi
          ? "OHLCV and Block70 signals are served from the Block70 API (cached). Indicators use Wilder RSI, EMA MACD (12,26,9), and SMA overlays. Not investment advice."
          : "Prices from public market APIs. Not investment advice."}
      </p>
    </section>
  );
}

function IndicatorToggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition",
        active
          ? "border-sky-500/60 bg-sky-500/15 text-sky-200"
          : "border-slate-700 bg-slate-800/40 text-slate-500 hover:border-slate-600 hover:text-slate-300"
      )}
    >
      {label}
    </button>
  );
}
