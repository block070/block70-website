"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import useSWR from "swr";
import { useEffect } from "react";
import { clsx } from "clsx";
import type { TraderScannerRow } from "@/lib/coins-scanner";
import { formatChangePct, formatCompactUsd, formatPrice } from "@/lib/format";
import type { CoinSignalsPayload } from "@/lib/coin-signals-types";

const PriceChart = dynamic(
  () => import("@/components/charts/price-chart").then((m) => ({ default: m.PriceChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] animate-pulse rounded-lg border border-slate-800 bg-slate-900/80" />
    ),
  },
);

const signalFetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("signals");
    return r.json() as Promise<CoinSignalsPayload>;
  });

type Props = {
  row: TraderScannerRow | null;
  open: boolean;
  onClose: () => void;
};

export function CoinQuickViewPanel({ row, open, onClose }: Props) {
  const sym = row?.symbol ?? "";
  const { data: sig } = useSWR(row && open ? `/api/coin-signals/${encodeURIComponent(sym)}` : null, signalFetcher);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !row) return null;

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
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Quick view</p>
            <h2 className="text-lg font-semibold text-slate-100">
              {row.name}{" "}
              <span className="text-slate-400">({row.symbol})</span>
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chart</h3>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-800">
              <PriceChart slug={row.slug} height={220} className="w-full" />
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Smart score <span className="font-semibold text-emerald-400">{row.smartMoneyScore}</span> with{" "}
              <span className="text-slate-200">{row.trendLabel}</span> tone. Market cap{" "}
              {formatCompactUsd(row.marketCapUsd)}; volume to mcap{" "}
              <span className="font-[family-name:var(--font-jetbrains)]">
                {(row.volToMcap * 100).toFixed(1)}%
              </span>
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {row.categoryTags.slice(0, 6).map((c) => (
                <span
                  key={c}
                  className="rounded-md border border-slate-700/80 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-300"
                >
                  {c}
                </span>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[...row.narrativeTags, ...row.signalTags].map((t) => (
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
            {sig ? (
              <ul className="mt-2 space-y-2 text-sm text-slate-300">
                <li className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                  <span className="text-[11px] uppercase text-slate-500">Desk read</span>
                  <p className="mt-1 capitalize">Sentiment: {sig.sentiment}</p>
                  <p className="font-[family-name:var(--font-jetbrains)] text-xs text-slate-400">
                    Score {(sig.sentimentScore * 100).toFixed(0)} / 100
                  </p>
                </li>
                {sig.topics?.slice(0, 4).map((t) => (
                  <li
                    key={t.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-200"
                  >
                    {t.headline}
                  </li>
                ))}
                {!sig.topics?.length ? (
                  <li className="text-xs text-slate-500">
                    No live topic feed — showing row-level tags above.
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Loading signals…</p>
            )}
          </section>

          <div className="mt-8 flex gap-2">
            <Link
              href={`/coins/${row.slug}`}
              className="flex-1 rounded-lg border border-crypto-blue/50 bg-crypto-blue/10 py-2.5 text-center text-sm font-semibold text-crypto-blue hover:bg-crypto-blue/20"
            >
              Full coin page
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
