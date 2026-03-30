"use client";

import Link from "next/link";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { List, type RowComponentProps } from "react-window";
import { clsx } from "clsx";
import { CoinSymbol } from "@/components/market/coin-symbol";
import { SparklineSvg } from "@/components/market/sparkline-svg";
import {
  applyTraderSort,
  matchesCategoryPreset,
  matchesMcapBucket,
  matchesMomentumFilter,
  matchesSentimentFilter,
  trendFromScore,
  type CategoryPreset,
  type McapBucket,
  type MomentumSentimentFilter,
  type TraderScannerRow,
  type TraderSortMode,
} from "@/lib/coins-scanner";
import { getApiBaseUrl } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { SignalDto } from "@/lib/types";
import { formatChangePct, formatCompactUsd, formatPrice } from "@/lib/format";

const ROW_H = 48;
const VIRT_THRESHOLD = 20;
const PAGE_LIMIT = 100;

type CoinsApiResponse = {
  items: TraderScannerRow[];
  nextOffset: number;
  hasMore: boolean;
  generatedAt: string;
};

/** Ensures `sentimentLabel` exists for older cached API payloads. */
function normalizeTraderRow(r: TraderScannerRow): TraderScannerRow {
  if (r.sentimentLabel != null) return r;
  return { ...r, sentimentLabel: trendFromScore(r.block70Score) };
}

const ScoreCell = memo(function ScoreCell({ score }: { score: number }) {
  const color =
    score >= 71 ? "text-emerald-400" : score <= 30 ? "text-red-400" : "text-amber-300/90";
  return <span className={clsx("font-semibold tabular-nums", color)}>{score}</span>;
});

function TagChip({
  label,
  variant,
}: {
  label: string;
  variant: "narrative" | "category" | "signal";
}) {
  const cls =
    variant === "signal"
      ? "border-crypto-blue/35 bg-crypto-blue/10 text-crypto-blue"
      : variant === "narrative"
        ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
        : "border-slate-600/80 bg-slate-900/70 text-slate-300";
  return (
    <span
      className={clsx(
        "max-w-[100px] truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        cls
      )}
    >
      {label}
    </span>
  );
}

type RowData = {
  rows: TraderScannerRow[];
  onOpen: (row: TraderScannerRow) => void;
};

const gridCols =
  "grid-cols-[36px_minmax(140px,1.1fr)_88px_72px_92px_92px_minmax(200px,1.4fr)_56px]";

function VirtualRow(props: RowComponentProps<RowData>) {
  const { index, style, ariaAttributes, rows, onOpen } = props;
  const row = rows[index]!;
  const p24 = row.change24hPct;

  return (
    <div
      {...ariaAttributes}
      style={style as CSSProperties}
      className="border-b border-slate-800/80 bg-slate-950/40"
    >
      <button
        type="button"
        onClick={() => onOpen(row)}
        className={clsx(
          "grid h-full w-full min-w-[980px] cursor-pointer items-center gap-1 px-2 text-left text-xs transition-colors hover:bg-slate-800/50",
          gridCols
        )}
      >
        <div className="text-slate-500 tabular-nums">{index + 1}</div>
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/coins/${row.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="flex min-w-0 items-center gap-2"
          >
            <CoinSymbol
              symbol={row.symbol}
              logoUrl={row.logoUrl}
              name={row.name}
              size="md"
              iconOnly
            />
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-100">{row.name}</div>
              <div className="truncate text-[11px] text-slate-500">{row.symbol}</div>
            </div>
          </Link>
        </div>
        <div className="text-right tabular-nums text-slate-100">{formatPrice(row.priceUsd)}</div>
        <div
          className={clsx(
            "text-right tabular-nums",
            Number.isFinite(p24) ? (p24 >= 0 ? "text-emerald-400" : "text-red-400") : "text-slate-500"
          )}
        >
          {formatChangePct(p24)}
        </div>
        <div className="text-right text-slate-200">{formatCompactUsd(row.volume24hUsd)}</div>
        <div className="text-right text-slate-200">{formatCompactUsd(row.marketCapUsd)}</div>
        <div className="flex min-w-0 flex-wrap gap-1">
          {row.narrativeTags.slice(0, 3).map((t) => (
            <TagChip key={`n-${t}`} label={t} variant="narrative" />
          ))}
          {row.categoryTags.slice(0, 2).map((t) => (
            <TagChip key={`c-${t}`} label={t} variant="category" />
          ))}
          {row.signalTags.slice(0, 2).map((t) => (
            <TagChip key={`s-${t}`} label={t} variant="signal" />
          ))}
        </div>
        <div className="text-right">
          <ScoreCell score={row.smartMoneyScore} />
        </div>
      </button>
    </div>
  );
}

function StaticRow({
  row,
  index,
  onOpen,
}: {
  row: TraderScannerRow;
  index: number;
  onOpen: (row: TraderScannerRow) => void;
}) {
  const p24 = row.change24hPct;
  return (
    <div className="border-b border-slate-800/80 bg-slate-950/40">
      <button
        type="button"
        onClick={() => onOpen(row)}
        className={clsx(
          "grid w-full min-w-[980px] cursor-pointer items-center gap-1 px-2 py-2 text-left text-xs transition-colors hover:bg-slate-800/50",
          gridCols
        )}
        style={{ minHeight: ROW_H }}
      >
        <div className="text-slate-500 tabular-nums">{index + 1}</div>
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/coins/${row.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="flex min-w-0 items-center gap-2"
          >
            <CoinSymbol
              symbol={row.symbol}
              logoUrl={row.logoUrl}
              name={row.name}
              size="md"
              iconOnly
            />
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-100">{row.name}</div>
              <div className="truncate text-[11px] text-slate-500">{row.symbol}</div>
            </div>
          </Link>
        </div>
        <div className="text-right tabular-nums text-slate-100">{formatPrice(row.priceUsd)}</div>
        <div
          className={clsx(
            "text-right tabular-nums",
            Number.isFinite(p24) ? (p24 >= 0 ? "text-emerald-400" : "text-red-400") : "text-slate-500"
          )}
        >
          {formatChangePct(p24)}
        </div>
        <div className="text-right text-slate-200">{formatCompactUsd(row.volume24hUsd)}</div>
        <div className="text-right text-slate-200">{formatCompactUsd(row.marketCapUsd)}</div>
        <div className="flex min-w-0 flex-wrap gap-1">
          {row.narrativeTags.slice(0, 3).map((t) => (
            <TagChip key={`n-${t}`} label={t} variant="narrative" />
          ))}
          {row.categoryTags.slice(0, 2).map((t) => (
            <TagChip key={`c-${t}`} label={t} variant="category" />
          ))}
          {row.signalTags.slice(0, 2).map((t) => (
            <TagChip key={`s-${t}`} label={t} variant="signal" />
          ))}
        </div>
        <div className="text-right">
          <ScoreCell score={row.smartMoneyScore} />
        </div>
      </button>
    </div>
  );
}

function ScannerSlideOut({
  row,
  open,
  onClose,
}: {
  row: TraderScannerRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const [chartPts, setChartPts] = useState<number[]>([]);
  const [chartErr, setChartErr] = useState(false);
  const [signals, setSignals] = useState<SignalDto[] | null>(null);
  const [signalsErr, setSignalsErr] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setChartErr(false);
    setChartPts([]);
    const ac = new AbortController();
    fetch(`/api/coins/${encodeURIComponent(row.slug)}/chart?days=7`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d: { prices?: [number, number][] }) => {
        const pts = (d.prices ?? []).map((p) => p[1]).filter((n) => Number.isFinite(n));
        setChartPts(pts.length ? pts : []);
        if (!pts.length) setChartErr(true);
      })
      .catch(() => setChartErr(true));
    return () => ac.abort();
  }, [open, row]);

  useEffect(() => {
    if (!open || !row) return;
    setSignals(null);
    setSignalsErr(false);
    const ac = new AbortController();
    const base = getApiBaseUrl().replace(/\/$/, "");
    const path = `/api/v1/signals/${encodeURIComponent(row.symbol)}?limit=20`;
    const url = base ? `${base}${path}` : path;
    const tok = getToken();
    const headers: HeadersInit = { Accept: "application/json" };
    if (tok) (headers as Record<string, string>).Authorization = `Bearer ${tok}`;
    fetch(url, { signal: ac.signal, headers })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        setSignals(Array.isArray(data) ? (data as SignalDto[]) : []);
      })
      .catch(() => {
        setSignalsErr(true);
        setSignals([]);
      });
    return () => ac.abort();
  }, [open, row]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !row) return null;

  const pos7d =
    typeof row.change7dPct === "number" && Number.isFinite(row.change7dPct)
      ? row.change7dPct >= 0
      : true;

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        className={clsx(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 shadow-2xl"
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Quick view</p>
            <h2 className="text-lg font-semibold text-slate-100">
              {row.name} <span className="text-slate-400">({row.symbol})</span>
            </h2>
            <p className="mt-1 font-[family-name:var(--font-jetbrains)] text-sm text-slate-300">
              {formatPrice(row.priceUsd)} · {formatChangePct(row.change24hPct)} · Vol{" "}
              {formatCompactUsd(row.volume24hUsd)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800"
          >
            Esc
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chart (7d)</h3>
            <div className="mt-2 flex h-[160px] items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-900/50">
              {chartErr || chartPts.length < 2 ? (
                <p className="text-xs text-slate-500">Chart unavailable</p>
              ) : (
                <SparklineSvg points={chartPts} positive={pos7d} width={320} height={140} />
              )}
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Smart-money score{" "}
              <span className="font-semibold text-emerald-400">{row.smartMoneyScore}</span> blends liquidity,
              turnover, and signal tags. <span className="text-slate-200">Momentum (24h/7d): {row.trendLabel}</span>
              . <span className="text-slate-200">Model sentiment (B70): {row.sentimentLabel}</span>. Market cap{" "}
              {formatCompactUsd(row.marketCapUsd)}; vol/mcap{" "}
              <span className="font-[family-name:var(--font-jetbrains)]">
                {(row.volToMcap * 100).toFixed(1)}%
              </span>
              .
            </p>
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[...row.narrativeTags, ...row.categoryTags, ...row.signalTags].map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-crypto-blue/10 px-2 py-0.5 text-[10px] font-medium text-crypto-blue"
                >
                  {t}
                </span>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signals</h3>
            {signals === null && !signalsErr ? (
              <p className="mt-2 text-xs text-slate-500">Loading signals…</p>
            ) : signalsErr ? (
              <p className="mt-2 text-xs text-slate-500">Signals unavailable for this token.</p>
            ) : (signals?.length ?? 0) === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No signals returned.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {(signals ?? []).slice(0, 8).map((s) => (
                  <li
                    key={s.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-200"
                  >
                    <span className="text-[10px] uppercase text-slate-500">{s.signal_type}</span>
                    <p className="mt-1">{s.title ?? s.description ?? "—"}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="mt-8">
            <Link
              href={`/coins/${row.slug}`}
              className="block rounded-lg border border-crypto-blue/50 bg-crypto-blue/10 py-2.5 text-center text-sm font-semibold text-crypto-blue hover:bg-crypto-blue/20"
            >
              Full coin page
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

export function CoinsMarketScanner() {
  const [rows, setRows] = useState<TraderScannerRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelRow, setPanelRow] = useState<TraderScannerRow | null>(null);
  const [sortMode, setSortMode] = useState<TraderSortMode>("default");
  const [catPreset, setCatPreset] = useState<CategoryPreset>("all");
  const [mcapBucket, setMcapBucket] = useState<McapBucket>("all");
  const [momentum, setMomentum] = useState<MomentumSentimentFilter>("all");
  const [sentiment, setSentiment] = useState<MomentumSentimentFilter>("all");
  const [listH, setListH] = useState(480);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const ro = () =>
      setListH(Math.min(560, Math.max(280, Math.floor(window.innerHeight * 0.52))));
    ro();
    window.addEventListener("resize", ro);
    return () => window.removeEventListener("resize", ro);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/coins?limit=${PAGE_LIMIT}&offset=0`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load coins");
        return r.json() as Promise<CoinsApiResponse>;
      })
      .then((d) => {
        if (cancelled) return;
        setRows(d.items.map(normalizeTraderRow));
        setHasMore(d.hasMore);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(async () => {
    const offset = rows.length;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/coins?limit=${PAGE_LIMIT}&offset=${offset}`);
      if (!res.ok) throw new Error("Failed to load more");
      const d = (await res.json()) as CoinsApiResponse;
      setRows((prev) => [...prev, ...d.items.map(normalizeTraderRow)]);
      setHasMore(d.hasMore);
    } catch {
      setError("Could not load more");
    } finally {
      setLoadingMore(false);
    }
  }, [rows.length]);

  const filtered = useMemo(() => {
    return rows.filter(
      (r) =>
        matchesCategoryPreset(catPreset, r) &&
        matchesMcapBucket(mcapBucket, r) &&
        matchesMomentumFilter(momentum, r) &&
        matchesSentimentFilter(sentiment, r)
    );
  }, [rows, catPreset, mcapBucket, momentum, sentiment]);

  const sorted = useMemo(
    () => applyTraderSort(filtered, sortMode),
    [filtered, sortMode]
  );

  const onRowsRendered = useCallback(
    (visible: { startIndex: number; stopIndex: number }) => {
      if (!hasMore || loadingMore || loading) return;
      if (sorted.length === 0) return;
      if (visible.stopIndex < sorted.length - 1) return;
      void loadMore();
    },
    [hasMore, loadingMore, loading, sorted.length, loadMore],
  );

  const useVirt = sorted.length > VIRT_THRESHOLD;
  const listKey = `${sortMode}-${catPreset}-${mcapBucket}-${momentum}-${sentiment}-${sorted.length}-${rows.length}`;

  useEffect(() => {
    if (useVirt || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !loadingMore && !loading) {
          void loadMore();
        }
      },
      { root: null, rootMargin: "120px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [useVirt, hasMore, loadingMore, loading, loadMore, sorted.length]);

  const onOpen = useCallback((r: TraderScannerRow) => setPanelRow(r), []);

  const rowProps = useMemo(() => ({ rows: sorted, onOpen }), [sorted, onOpen]);

  return (
    <div className="space-y-4">
      <ScannerSlideOut row={panelRow} open={panelRow != null} onClose={() => setPanelRow(null)} />

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Sort</span>
          {(
            [
              ["default", "Default"] as const,
              ["trending", "Trending"] as const,
              ["volume_spike", "Volume spike"] as const,
              ["whale_accumulation", "Whale lean"] as const,
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSortMode(id)}
              className={clsx(
                "rounded-lg border px-2.5 py-1 text-xs font-medium transition",
                sortMode === id
                  ? "border-crypto-blue bg-crypto-blue/10 text-crypto-blue"
                  : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Category</span>
          {(
            [
              ["all", "All"],
              ["ai", "AI"],
              ["defi", "DeFi"],
              ["l1", "L1"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setCatPreset(id)}
              className={clsx(
                "rounded-lg border px-2.5 py-1 text-xs",
                catPreset === id
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                  : "border-slate-700 text-slate-400 hover:border-slate-500"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Mcap</span>
          {(
            [
              ["all", "All"],
              ["large", "Large"],
              ["mid", "Mid"],
              ["small", "Small"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMcapBucket(id)}
              className={clsx(
                "rounded-lg border px-2.5 py-1 text-xs",
                mcapBucket === id
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-slate-700 text-slate-400 hover:border-slate-500"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-[11px] uppercase tracking-wide text-slate-500"
            title="Blended 24h and 7d % change (price momentum)"
          >
            Momentum
          </span>
          {(
            [
              ["all", "All"],
              ["bull", "Bull"],
              ["neutral", "Neutral"],
              ["bear", "Bear"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMomentum(id)}
              className={clsx(
                "rounded-lg border px-2.5 py-1 text-xs",
                momentum === id
                  ? "border-sky-500/40 bg-sky-500/10 text-sky-200"
                  : "border-slate-700 text-slate-400 hover:border-slate-500"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-[11px] uppercase tracking-wide text-slate-500"
            title="Bucket from Block70 composite score (liquidity + momentum model)"
          >
            Sentiment
          </span>
          {(
            [
              ["all", "All"],
              ["bull", "Bull"],
              ["neutral", "Neutral"],
              ["bear", "Bear"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSentiment(id)}
              className={clsx(
                "rounded-lg border px-2.5 py-1 text-xs",
                sentiment === id
                  ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
                  : "border-slate-700 text-slate-400 hover:border-slate-500"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
        <div className="overflow-x-auto">
          <div
            className={clsx(
              "grid min-w-[980px] gap-1 border-b border-slate-800 bg-slate-900/90 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500",
              gridCols
            )}
          >
            <div>#</div>
            <div>Asset</div>
            <div className="text-right">Price</div>
            <div className="text-right">24h%</div>
            <div className="text-right">Volume</div>
            <div className="text-right">MCap</div>
            <div>Tags</div>
            <div className="text-right">Smart</div>
          </div>
        </div>

        {loading && rows.length === 0 ? (
          <div className="h-[400px] animate-pulse bg-slate-900/40" />
        ) : useVirt ? (
          <div className="w-full">
            <List
              key={listKey}
              rowCount={sorted.length}
              rowHeight={ROW_H}
              rowComponent={VirtualRow}
              rowProps={rowProps}
              defaultHeight={listH}
              style={{ height: listH, width: "100%" }}
              onRowsRendered={onRowsRendered}
            />
          </div>
        ) : (
          <div>
            {sorted.map((row, i) => (
              <StaticRow key={`${row.slug}-${i}`} row={row} index={i} onOpen={onOpen} />
            ))}
            {hasMore ? (
              <div ref={sentinelRef} className="h-1 w-full shrink-0" aria-hidden />
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Showing {sorted.length} of {rows.length} loaded
          {hasMore ? " · scroll to load more" : ""}
        </p>
        {loadingMore ? (
          <span className="text-xs text-amber-200/80">Loading more…</span>
        ) : hasMore ? (
          <span className="text-xs text-slate-600">Auto-loads when you reach the list end</span>
        ) : (
          <span className="text-xs text-slate-600">End of loaded data.</span>
        )}
      </div>
    </div>
  );
}
