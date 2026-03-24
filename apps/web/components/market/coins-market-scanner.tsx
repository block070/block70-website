"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { CoinSymbol } from "@/components/market/coin-symbol";
import { SparklineSvg } from "@/components/market/sparkline-svg";
import type { Coin } from "@/lib/crypto-mock";
import {
  type ColumnSort,
  type ColumnSortKey,
  type FilterPreset,
  enrichCoins,
  type ScannerCoin,
} from "@/lib/coins-scanner";
import { formatChangePct, formatCompactUsd, formatPrice } from "@/lib/format";
import { clsx } from "clsx";

const ROW_H = 44;
const VIRT_THRESHOLD = 50;

function nextColumnDir(
  key: ColumnSortKey,
  prev: ColumnSort | null
): "asc" | "desc" {
  if (prev?.key !== key) return "desc";
  return prev.dir === "desc" ? "asc" : "desc";
}

function applySort(
  rows: ScannerCoin[],
  preset: FilterPreset | null,
  col: ColumnSort | null
): ScannerCoin[] {
  const out = [...rows];
  if (col?.key) {
    const dir = col.dir === "desc" ? -1 : 1;
    if (col.key === "score") {
      out.sort((a, b) => dir * (b.block70Score - a.block70Score));
    } else if (col.key === "mcap") {
      out.sort((a, b) => dir * ((b.marketCapUsd ?? 0) - (a.marketCapUsd ?? 0)));
    } else {
      out.sort((a, b) => dir * ((b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0)));
    }
    return out;
  }
  if (preset === "gainers") {
    out.sort((a, b) => (b.change24hPct ?? -Infinity) - (a.change24hPct ?? -Infinity));
  } else if (preset === "losers") {
    out.sort((a, b) => (a.change24hPct ?? Infinity) - (b.change24hPct ?? Infinity));
  } else if (preset === "score") {
    out.sort((a, b) => b.block70Score - a.block70Score);
  } else if (preset === "trending") {
    out.sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));
  } else {
    out.sort((a, b) => a.rank - b.rank);
  }
  return out;
}

const TrendBadge = memo(function TrendBadge({ label }: { label: ScannerCoin["trendLabel"] }) {
  const cls =
    label === "Bull"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
      : label === "Bear"
        ? "bg-red-500/15 text-red-300 border-red-500/40"
        : "bg-amber-500/15 text-amber-200 border-amber-500/35";
  return (
    <span
      className={clsx(
        "inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        cls
      )}
    >
      {label}
    </span>
  );
});

const ScoreCell = memo(function ScoreCell({ score }: { score: number }) {
  const color =
    score >= 71 ? "text-emerald-400" : score <= 30 ? "text-red-400" : "text-amber-300/90";
  return <span className={clsx("font-semibold tabular-nums", color)}>{score}</span>;
});

type RowProps = {
  coin: ScannerCoin;
  onRowClick: (slug: string) => void;
};

const ScannerRow = memo(function ScannerRow({ coin, onRowClick }: RowProps) {
  const { slug } = coin;
  const pos7d =
    typeof coin.change7dPct === "number" && Number.isFinite(coin.change7dPct)
      ? coin.change7dPct >= 0
      : true;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onRowClick(slug)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowClick(slug);
        }
      }}
      className="grid cursor-pointer items-center gap-px border-b border-slate-800/80 bg-slate-950/40 px-2 text-xs transition-colors hover:bg-slate-800/50"
      style={{
        gridTemplateColumns:
          "44px minmax(140px,1.2fr) 88px 72px 72px 96px 96px 72px 88px 104px",
        minHeight: ROW_H,
      }}
    >
      <div className="text-slate-500 tabular-nums">{coin.rank}</div>
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={`/coins/${slug}`}
          className="flex min-w-0 items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <CoinSymbol
            symbol={coin.symbol}
            logoUrl={coin.logoUrl}
            name={coin.name}
            size="md"
            iconOnly
          />
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-100">{coin.name}</div>
            <div className="truncate text-[11px] text-slate-500">{coin.symbol}</div>
          </div>
        </Link>
      </div>
      <div className="text-right tabular-nums text-slate-100">{formatPrice(coin.priceUsd)}</div>
      <div
        className={clsx(
          "text-right tabular-nums",
          typeof coin.change24hPct === "number" && Number.isFinite(coin.change24hPct)
            ? coin.change24hPct >= 0
              ? "text-emerald-400"
              : "text-red-400"
            : "text-slate-500"
        )}
      >
        {formatChangePct(coin.change24hPct)}
      </div>
      <div
        className={clsx(
          "text-right tabular-nums",
          typeof coin.change7dPct === "number" && Number.isFinite(coin.change7dPct)
            ? coin.change7dPct >= 0
              ? "text-emerald-400"
              : "text-red-400"
            : "text-slate-500"
        )}
      >
        {formatChangePct(coin.change7dPct)}
      </div>
      <div className="text-right text-slate-200">{formatCompactUsd(coin.marketCapUsd)}</div>
      <div className="text-right text-slate-200">{formatCompactUsd(coin.volume24hUsd)}</div>
      <div className="text-right">
        <ScoreCell score={coin.block70Score} />
      </div>
      <div className="flex justify-end">
        <TrendBadge label={coin.trendLabel} />
      </div>
      <div className="flex justify-end">
        <SparklineSvg points={coin.sparkline7d} positive={pos7d} width={100} height={30} />
      </div>
    </div>
  );
});

type Props = {
  initialCoins: Coin[];
};

export function CoinsMarketScanner({ initialCoins }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preset, setPreset] = useState<FilterPreset | null>(null);
  const [columnSort, setColumnSort] = useState<ColumnSort | null>(null);

  const enriched = useMemo(() => enrichCoins(initialCoins), [initialCoins]);

  const sorted = useMemo(
    () => applySort(enriched, preset, columnSort),
    [enriched, preset, columnSort]
  );

  const topOpportunities = useMemo(() => {
    return [...enriched].sort((a, b) => b.block70Score - a.block70Score).slice(0, 5);
  }, [enriched]);

  const onRowClick = useCallback(
    (slug: string) => {
      startTransition(() => {
        router.push(`/coins/${slug}`);
      });
    },
    [router]
  );

  const setFilter = (p: FilterPreset) => {
    startTransition(() => {
      setPreset((prev) => (prev === p ? null : p));
      setColumnSort(null);
    });
  };

  const onColumnClick = (key: ColumnSortKey) => {
    startTransition(() => {
      setPreset(null);
      setColumnSort((prev) => {
        const dir = nextColumnDir(key, prev);
        return { key, dir };
      });
    });
  };

  const parentRef = useRef<HTMLDivElement>(null);
  const useVirt = sorted.length >= VIRT_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  const headerCols =
    "grid gap-px px-2 text-[11px] font-medium uppercase tracking-wide text-slate-500";
  const gridStyle = {
    gridTemplateColumns:
      "44px minmax(140px,1.2fr) 88px 72px 72px 96px 96px 72px 88px 104px",
  };

  return (
    <div className="space-y-4">
      {topOpportunities.length > 0 && (
        <section className="rounded-xl border border-amber-500/20 bg-slate-900/40 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <span aria-hidden>🔥</span> Top opportunities
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {topOpportunities.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/coins/${c.slug}`}
                  className="flex flex-col rounded-lg border border-slate-700/60 bg-slate-950/50 px-3 py-2 transition hover:border-crypto-blue/40 hover:bg-slate-800/40"
                >
                  <span className="truncate font-medium text-slate-100">{c.name}</span>
                  <span className="mt-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400/90">Score {c.block70Score}</span>
                    <span
                      className={
                        typeof c.change24hPct === "number" && c.change24hPct >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {formatChangePct(c.change24hPct)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-xs text-slate-500">Quick filters</span>
        {(
          [
            ["gainers", "Top gainers"] as const,
            ["losers", "Top losers"] as const,
            ["score", "Highest score"] as const,
            ["trending", "Trending"] as const,
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={clsx(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
              preset === id
                ? "border-crypto-blue bg-crypto-blue/10 text-crypto-blue"
                : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
        <div
          className={clsx(headerCols, "border-b border-slate-800 bg-slate-900/90 py-2")}
          style={gridStyle}
        >
          <div>#</div>
          <div>Coin</div>
          <div className="text-right">Price</div>
          <div className="text-right">24h</div>
          <div className="text-right">7d</div>
          <div className="text-right">
            <button
              type="button"
              onClick={() => onColumnClick("mcap")}
              className="hover:text-slate-300"
            >
              MCap ↕
            </button>
          </div>
          <div className="text-right">
            <button
              type="button"
              onClick={() => onColumnClick("volume")}
              className="hover:text-slate-300"
            >
              Vol ↕
            </button>
          </div>
          <div className="text-right">
            <button
              type="button"
              onClick={() => onColumnClick("score")}
              className="hover:text-slate-300"
            >
              B70 ↕
            </button>
          </div>
          <div className="text-right">Trend</div>
          <div className="text-right">Spark</div>
        </div>

        {useVirt ? (
          <div
            ref={parentRef}
            className="max-h-[min(70vh,520px)] overflow-y-auto"
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((vi) => {
                const coin = sorted[vi.index];
                return (
                  <div
                    key={coin.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vi.start}px)`,
                    }}
                  >
                    <ScannerRow coin={coin} onRowClick={onRowClick} />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={clsx(isPending && "opacity-80")}>
            {sorted.map((coin) => (
              <ScannerRow key={coin.id} coin={coin} onRowClick={onRowClick} />
            ))}
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
