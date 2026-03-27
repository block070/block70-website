"use client";

import Link from "next/link";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { List, type RowComponentProps } from "react-window";
import useSWR from "swr";
import { clsx } from "clsx";
import { CoinSymbol } from "@/components/market/coin-symbol";
import { CoinQuickViewPanel } from "@/components/market/coin-quick-view-panel";
import {
  applyTraderSort,
  type TraderScannerRow,
  type TraderSortMode,
} from "@/lib/coins-scanner";
import { formatChangePct, formatCompactUsd, formatPrice } from "@/lib/format";

const ROW_H = 52;
const PAGE = 100;

type SortMode = "trending" | "volume_spike" | "whale_accum";

type CatFilter = "all" | "ai" | "defi" | "l1";
type McapFilter = "all" | "large" | "mid" | "small";
type MomFilter = "all" | "up" | "down" | "flat";
type SentFilter = "all" | "bull" | "neutral" | "bear";

type CoinsApiResponse = {
  items: TraderScannerRow[];
  nextOffset: number;
  hasMore: boolean;
  generatedAt: string;
};

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to load coins");
    return r.json() as Promise<CoinsApiResponse>;
  });

function matchesCategory(f: CatFilter, row: TraderScannerRow): boolean {
  if (f === "all") return true;
  const blob = [...row.categoryTags, ...row.narrativeTags].join(" ").toLowerCase();
  if (f === "ai") return blob.includes("ai") || blob.includes("big data");
  if (f === "defi") return blob.includes("defi");
  if (f === "l1") return blob.includes("l1") || blob.includes("layer 1");
  return true;
}

function matchesMcap(f: McapFilter, row: TraderScannerRow): boolean {
  const m = row.marketCapUsd ?? 0;
  if (f === "all") return true;
  if (f === "large") return m >= 10e9;
  if (f === "mid") return m >= 1e9 && m < 10e9;
  if (f === "small") return m > 0 && m < 1e9;
  return true;
}

function matchesMomentum(f: MomFilter, row: TraderScannerRow): boolean {
  const c = row.change24hPct;
  if (f === "all") return true;
  if (!Number.isFinite(c)) return f === "flat";
  if (f === "up") return c >= 3;
  if (f === "down") return c <= -3;
  if (f === "flat") return c > -3 && c < 3;
  return true;
}

function matchesSentiment(f: SentFilter, row: TraderScannerRow): boolean {
  if (f === "all") return true;
  if (f === "bull") return row.sentimentLabel === "Bull";
  if (f === "bear") return row.sentimentLabel === "Bear";
  if (f === "neutral") return row.sentimentLabel === "Neutral";
  return true;
}

function toTraderSortMode(mode: SortMode): TraderSortMode {
  if (mode === "whale_accum") return "whale_accumulation";
  return mode;
}

type ScreenerRowContext = {
  rows: TraderScannerRow[];
  onOpen: (row: TraderScannerRow) => void;
};

function VirtualRow(props: RowComponentProps<ScreenerRowContext>) {
  const { index, style, ariaAttributes, rows, onOpen } = props;
  const row = rows[index]!;
  const p24 = row.change24hPct;
  return (
    <div
      {...ariaAttributes}
      style={style as CSSProperties}
      className="border-b border-slate-800/90 bg-slate-950/50"
    >
      <button
        type="button"
        onClick={() => onOpen(row)}
        className="grid h-full w-full min-w-[1040px] cursor-pointer grid-cols-[minmax(200px,1.4fr)_88px_72px_92px_92px_minmax(160px,1fr)_72px] items-center gap-2 px-2 text-left text-xs transition-colors hover:bg-slate-800/55"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/coins/${row.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="flex min-w-0 items-center gap-2"
          >
            <CoinSymbol symbol={row.symbol} logoUrl={row.logoUrl} name={row.name} size="md" iconOnly />
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-100">{row.name}</div>
              <div className="truncate text-[11px] text-slate-500">{row.symbol}</div>
            </div>
          </Link>
        </div>
        <div className="text-right font-[family-name:var(--font-jetbrains)] text-slate-100">
          {formatPrice(row.priceUsd)}
        </div>
        <div
          className={clsx(
            "text-right font-[family-name:var(--font-jetbrains)]",
            Number.isFinite(p24) ? (p24 >= 0 ? "text-emerald-400" : "text-red-400") : "text-slate-500"
          )}
        >
          {formatChangePct(p24)}
        </div>
        <div className="text-right text-slate-200">{formatCompactUsd(row.volume24hUsd)}</div>
        <div className="text-right text-slate-200">{formatCompactUsd(row.marketCapUsd)}</div>
        <div className="flex min-w-0 flex-wrap gap-1">
          {[...row.categoryTags, ...row.narrativeTags].slice(0, 3).map((t) => (
            <span
              key={t}
              className="max-w-[80px] truncate rounded border border-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-400"
            >
              {t}
            </span>
          ))}
          {row.signalTags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="max-w-[88px] truncate rounded bg-crypto-blue/10 px-1.5 py-0.5 text-[10px] font-medium text-crypto-blue"
            >
              {t}
            </span>
          ))}
        </div>
        <div className="text-right font-[family-name:var(--font-jetbrains)] font-semibold text-emerald-400/95">
          {row.smartMoneyScore}
        </div>
      </button>
    </div>
  );
}

export function CoinsTraderRadar() {
  const [listH, setListH] = useState(520);
  const [pages, setPages] = useState<CoinsApiResponse[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [panelRow, setPanelRow] = useState<TraderScannerRow | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("trending");
  const [catF, setCatF] = useState<CatFilter>("all");
  const [mcapF, setMcapF] = useState<McapFilter>("all");
  const [momF, setMomF] = useState<MomFilter>("all");
  const [sentF, setSentF] = useState<SentFilter>("all");

  const { data: first, error, isLoading } = useSWR(`/api/coins?limit=${PAGE}&offset=0`, fetcher);

  useLayoutEffect(() => {
    const ro = () =>
      setListH(Math.min(560, Math.max(320, Math.floor(window.innerHeight * 0.58))));
    ro();
    window.addEventListener("resize", ro);
    return () => window.removeEventListener("resize", ro);
  }, []);

  const merged = useMemo(() => {
    const base = first?.items ?? [];
    const rest = pages.flatMap((p) => p.items);
    return [...base, ...rest];
  }, [first, pages]);

  const filtered = useMemo(() => {
    return merged.filter(
      (r) =>
        matchesCategory(catF, r) &&
        matchesMcap(mcapF, r) &&
        matchesMomentum(momF, r) &&
        matchesSentiment(sentF, r)
    );
  }, [merged, catF, mcapF, momF, sentF]);

  const sorted = useMemo(
    () => applyTraderSort(filtered, toTraderSortMode(sortMode)),
    [filtered, sortMode]
  );

  const listKey = `${sortMode}-${catF}-${mcapF}-${momF}-${sentF}-${merged.length}`;

  const loadMore = useCallback(async () => {
    const offset = merged.length;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/coins?limit=${PAGE}&offset=${offset}`);
      const payload = (await res.json()) as CoinsApiResponse;
      if (payload.items?.length) {
        setPages((p) => [...p, payload]);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [merged.length]);

  const tail = pages.length > 0 ? pages[pages.length - 1] : first;
  const hasMore = Boolean(tail?.hasMore && tail.items.length >= PAGE);

  const onOpen = useCallback((row: TraderScannerRow) => setPanelRow(row), []);

  const rowProps = useMemo(() => ({ rows: sorted, onOpen }), [sorted, onOpen]);

  return (
    <div className="space-y-5">
      <CoinQuickViewPanel row={panelRow} open={panelRow != null} onClose={() => setPanelRow(null)} />

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Sort</span>
          {(
            [
              ["trending", "Trending"] as const,
              ["volume_spike", "Volume spike"] as const,
              ["whale_accum", "Whale lean"] as const,
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSortMode(id)}
              className={clsx(
                "rounded-lg border px-2.5 py-1 text-xs font-medium",
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
              onClick={() => setCatF(id)}
              className={clsx(
                "rounded-lg border px-2.5 py-1 text-xs",
                catF === id
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
              onClick={() => setMcapF(id)}
              className={clsx(
                "rounded-lg border px-2.5 py-1 text-xs",
                mcapF === id
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-slate-700 text-slate-400 hover:border-slate-500"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Momentum</span>
          {(
            [
              ["all", "All"],
              ["up", "Hot"],
              ["flat", "Flat"],
              ["down", "Cold"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMomF(id)}
              className={clsx(
                "rounded-lg border px-2.5 py-1 text-xs",
                momF === id
                  ? "border-sky-500/40 bg-sky-500/10 text-sky-200"
                  : "border-slate-700 text-slate-400 hover:border-slate-500"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Sentiment</span>
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
              onClick={() => setSentF(id)}
              className={clsx(
                "rounded-lg border px-2.5 py-1 text-xs",
                sentF === id
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
          Screener unavailable. Check API configuration.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[1040px] gap-2 border-b border-slate-800 bg-slate-900/95 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            style={{
              gridTemplateColumns:
                "minmax(200px,1.4fr) 88px 72px 92px 92px minmax(160px,1fr) 72px",
            }}
          >
            <div>Asset</div>
            <div className="text-right">Price</div>
            <div className="text-right">24h</div>
            <div className="text-right">Volume</div>
            <div className="text-right">Mcap</div>
            <div>Tags</div>
            <div className="text-right">Smart</div>
          </div>
        </div>
        {isLoading && !merged.length ? (
          <div className="h-[420px] animate-pulse bg-slate-900/40" />
        ) : (
          <div className="h-[min(70vh,560px)] w-full">
            <List
              key={listKey}
              rowCount={sorted.length}
              rowHeight={ROW_H}
              rowComponent={VirtualRow}
              rowProps={rowProps}
              defaultHeight={listH}
              style={{ height: listH, width: "100%" }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Showing {sorted.length} of {merged.length} loaded
        </p>
        {hasMore ? (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:border-crypto-blue disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load next 100"}
          </button>
        ) : (
          <span className="text-xs text-slate-600">End of batch — adjust filters or refresh.</span>
        )}
      </div>
    </div>
  );
}
