"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CoinSymbol } from "@/components/market/coin-symbol";
import { SparklineSvg } from "@/components/market/sparkline-svg";
import { getExchangeBuyUrls } from "@/lib/exchange-buy-urls";
import { formatChangePct, formatCompactUsd, formatPrice } from "@/lib/format";
import type { EnrichedTrendingRow } from "@/lib/trending-metrics";
import {
  momentumGlyph,
  momentumTitle,
  smartMoneyDisplay,
  TRENDING_TABS,
  tierScoreClasses,
  type TrendTab,
} from "@/lib/trending-metrics";
import type { TrendingOpportunity } from "@/lib/trending-page-data";
import { filterRowsByTab } from "@/lib/trending-page-data";
import { clsx } from "clsx";

type Props = {
  initialRows: EnrichedTrendingRow[];
  initialOpportunities: TrendingOpportunity[];
  initialUpdatedAt: string;
  isFallback: boolean;
};

function useTrendingPoll(
  initialRows: EnrichedTrendingRow[],
  initialOpportunities: TrendingOpportunity[],
  initialUpdatedAt: string,
  intervalMs: number
) {
  const [rows, setRows] = useState(initialRows);
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [flashSlugs, setFlashSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    setRows(initialRows);
    setOpportunities(initialOpportunities);
    setUpdatedAt(initialUpdatedAt);
  }, [initialRows, initialOpportunities, initialUpdatedAt]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/trending", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          rows?: EnrichedTrendingRow[];
          opportunities?: TrendingOpportunity[];
          updatedAt?: string;
        };
        if (!data.rows?.length) return;

        setRows((prev) => {
          const flash = new Set<string>();
          for (const r of data.rows!) {
            const old = prev.find((p) => p.coin.slug === r.coin.slug);
            if (
              old &&
              (old.trendingScore !== r.trendingScore ||
                old.coin.priceUsd !== r.coin.priceUsd ||
                old.coin.change24hPct !== r.coin.change24hPct)
            ) {
              flash.add(r.coin.slug);
            }
          }
          if (flash.size > 0) {
            setFlashSlugs(flash);
            window.setTimeout(() => {
              if (!cancelled) setFlashSlugs(new Set());
            }, 1400);
          }
          return data.rows!;
        });
        if (data.opportunities) setOpportunities(data.opportunities);
        if (data.updatedAt) setUpdatedAt(data.updatedAt);
      } catch {
        /* ignore */
      }
    };

    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return { rows, opportunities, updatedAt, flashSlugs };
}

const OpportunityCard = memo(function OpportunityCard({
  o,
}: {
  o: TrendingOpportunity;
}) {
  const ch = o.change24hPct;
  const pos = typeof ch === "number" && Number.isFinite(ch) && ch >= 0;
  return (
    <div className="flex min-w-[200px] flex-1 flex-col gap-2 rounded-lg border border-orange-500/35 bg-gradient-to-br from-orange-950/50 to-slate-950/80 p-3">
      <div className="flex items-center gap-2">
        <CoinSymbol
          symbol={o.symbol}
          logoUrl={o.logoUrl}
          name={o.name}
          size="sm"
          iconOnly
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">{o.name}</p>
          <p className="text-[10px] text-slate-500">
            T {o.trendingScore} · B70 {o.block70Score}
          </p>
        </div>
      </div>
      <p
        className={clsx(
          "text-xs font-medium tabular-nums",
          pos ? "text-emerald-400" : "text-red-400"
        )}
      >
        {formatChangePct(ch)}
        <span className="text-slate-500"> 24h</span>
      </p>
      <Link
        href={`/coins/${encodeURIComponent(o.slug)}`}
        className="inline-flex w-full items-center justify-center rounded-md bg-orange-500/90 py-1.5 text-center text-[11px] font-semibold text-slate-950 transition hover:bg-orange-400"
      >
        View Analysis
      </Link>
    </div>
  );
});

export function TrendingPageClient({
  initialRows,
  initialOpportunities,
  initialUpdatedAt,
  isFallback,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TrendTab>("all");
  const { rows, opportunities, updatedAt, flashSlugs } = useTrendingPoll(
    initialRows,
    initialOpportunities,
    initialUpdatedAt,
    60_000
  );

  const filtered = useMemo(() => filterRowsByTab(rows, tab), [rows, tab]);

  const onRowNav = useCallback(
    (slug: string) => {
      router.push(`/coins/${encodeURIComponent(slug)}`);
    },
    [router]
  );

  return (
    <div className="space-y-5">
      {isFallback && (
        <div className="rounded-xl border border-amber-900/60 bg-amber-950/40 p-3 text-xs text-amber-200">
          Showing sample data — API temporarily unavailable.{" "}
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={() => router.refresh()}
          >
            Retry
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Best exchange to buy trending coins
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Compare fees and liquidity on major venues — trade where execution fits your size.
        </p>
        <Link
          href="/exchanges"
          className="mt-2 inline-block text-xs font-medium text-blue-400 hover:text-blue-300"
        >
          Browse exchanges →
        </Link>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg" aria-hidden>
            🔥
          </span>
          <h2 className="text-base font-semibold tracking-tight text-slate-100">
            Top opportunities right now
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          Highest blend of Trending Score and Block70 Score — not financial advice.
        </p>
        <div className="flex flex-wrap gap-3">
          {opportunities.map((o) => (
            <OpportunityCard key={o.slug} o={o} />
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <div className="flex flex-wrap gap-1">
          {TRENDING_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                "rounded-full px-3 py-1 text-[11px] font-medium transition",
                tab === t.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 tabular-nums">
          Updated {new Date(updatedAt).toLocaleTimeString()} · auto-refresh 60s
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
        <table className="min-w-[1100px] w-full border-collapse text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-slate-900/95 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-2 py-2 font-medium">Rank</th>
              <th className="min-w-[140px] px-2 py-2 font-medium">Coin</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Price</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium">24h %</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Vol 24h</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Trending</th>
              <th className="whitespace-nowrap px-2 py-2 font-medium">Signal</th>
              <th className="min-w-[100px] px-2 py-2 font-medium">Why</th>
              <th
                className="whitespace-nowrap px-2 py-2 font-medium"
                title="Heuristic from momentum + turnover vs market cap (on-chain netflow when wired)"
              >
                Smart $
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-center font-medium">Momentum</th>
              <th className="whitespace-nowrap px-2 py-2 font-medium">Spark 7d</th>
              <th className="w-10 px-1 py-2" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/90">
            {filtered.map((row, idx) => {
              const c = row.coin;
              const tier = row.tier;
              const sm = smartMoneyDisplay(row.smartMoney);
              const sparkPos =
                typeof c.change7dPct === "number" && Number.isFinite(c.change7dPct)
                  ? c.change7dPct >= 0
                  : true;
              const flash = flashSlugs.has(c.slug);
              const buyUrls = getExchangeBuyUrls(c.symbol, c.slug);

              return (
                <tr
                  key={c.slug}
                  tabIndex={0}
                  className={clsx(
                    "group relative cursor-pointer transition-colors",
                    flash ? "bg-amber-500/15" : "hover:bg-slate-800/55"
                  )}
                  onClick={() => onRowNav(c.slug)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowNav(c.slug);
                    }
                  }}
                >
                  <td className="px-2 py-1.5 tabular-nums text-slate-500">{idx + 1}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <CoinSymbol
                        symbol={c.symbol}
                        logoUrl={c.logoUrl}
                        name={c.name}
                        size="sm"
                        iconOnly
                      />
                      <div className="min-w-0 leading-tight">
                        <span className="block truncate font-medium text-slate-50">
                          {c.name}
                        </span>
                        <span className="text-[10px] text-slate-500">{c.symbol}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-100">
                    {formatPrice(c.priceUsd)}
                  </td>
                  <td
                    className={clsx(
                      "px-2 py-1.5 text-right tabular-nums",
                      typeof c.change24hPct === "number" && Number.isFinite(c.change24hPct)
                        ? c.change24hPct >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                        : "text-slate-500"
                    )}
                  >
                    {formatChangePct(c.change24hPct)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-300">
                    {formatCompactUsd(c.volume24hUsd)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <span
                      className={clsx(
                        "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-semibold tabular-nums",
                        tierScoreClasses(tier.tier)
                      )}
                      title={tier.label}
                    >
                      {row.trendingScore}
                      {tier.emoji ? <span className="text-[10px]">{tier.emoji}</span> : null}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={clsx(
                        "inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium",
                        row.quickSignal.className
                      )}
                    >
                      {row.quickSignal.label}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-400">
                    <span className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[10px] text-slate-300">
                      {row.whyTag}
                    </span>
                  </td>
                  <td className={clsx("px-2 py-1.5 text-[10px] font-medium", sm.className)}>
                    {sm.label}
                  </td>
                  <td
                    className="px-2 py-1.5 text-center text-slate-300"
                    title={momentumTitle(row.momentum)}
                  >
                    <span className="text-sm">{momentumGlyph(row.momentum)}</span>
                  </td>
                  <td className="px-2 py-1.5">
                    <SparklineSvg
                      points={row.sparkline7d}
                      width={72}
                      height={26}
                      positive={sparkPos}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <div className="flex flex-col items-end gap-1 opacity-0 transition group-hover:opacity-100">
                      <a
                        href={buyUrls.coinbase}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Buy
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-6 text-center text-xs text-slate-500">
            No coins in this category right now.
          </p>
        )}
      </div>
    </div>
  );
}
