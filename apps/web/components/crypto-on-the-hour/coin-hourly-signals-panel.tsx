"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { HourlySentimentMeter } from "@/components/crypto-on-the-hour/hourly-sentiment-meter";
import type { CoinSignalsPayload } from "@/lib/coin-signals-types";
import { coinHrefFromSymbol } from "@/lib/coin-symbol-slugs";

const REFRESH_MS = 3_600_000;

type Props = {
  symbol: string;
};

function formatHourLabel(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function CoinHourlySignalsPanel({ symbol }: Props) {
  const [data, setData] = useState<CoinSignalsPayload | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      const res = await fetch(
        `/api/coin-signals/${encodeURIComponent(symbol)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CoinSignalsPayload;
      setData(json);
      setUpdatedAt(Date.now());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    }
  }, [symbol]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  if (err && !data) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-rose-300">
        Crypto On the Hour signals unavailable ({err}).
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-500">
        Loading hourly intelligence…
      </section>
    );
  }

  const hasTopics = data.topics.length > 0;
  const reportLink =
    data.latestPipelineHourUnix != null
      ? `/crypto-on-the-hour/${data.latestPipelineHourUnix}`
      : null;

  return (
    <section
      id="crypto-on-the-hour"
      className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
            Crypto On the Hour
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Topics where <span className="text-slate-300">{data.symbol}</span> is tagged in
            the hourly clustering engine.
            {data.source === "empty" ? (
              <span className="ml-1 text-amber-400/90">
                (Connect CRYPTO_ON_THE_HOUR_URL for live data.)
              </span>
            ) : null}
          </p>
        </div>
        {reportLink ? (
          <Link
            href={reportLink}
            className="shrink-0 text-[11px] font-medium text-blue-400 hover:text-blue-300"
          >
            Latest hour →
          </Link>
        ) : null}
      </div>

      <HourlySentimentMeter sentiment={data.sentiment} score={data.sentimentScore} />

      {hasTopics ? (
        <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Trending topics ({data.symbol})
          </p>
          <ul className="mt-2 space-y-2">
            {data.topics.slice(0, 5).map((t) => (
              <li key={t.id} className="border-b border-slate-800/60 pb-2 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[12px] font-medium leading-snug text-slate-100">
                    {t.headline}
                  </p>
                  <span className="shrink-0 tabular-nums text-[11px] text-emerald-400/90">
                    {t.score100.toFixed(0)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500">
                  <span>{t.articleCount} articles</span>
                  <span>·</span>
                  <Link
                    href={`/crypto-on-the-hour/${t.reportHourUnix}`}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    {formatHourLabel(t.reportHourUnix)}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          No clustered topics with this symbol in mentioned assets yet. Run the hourly
          pipeline after migration 003.
        </p>
      )}

      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Latest mentions</p>
        {data.mentions.length ? (
          <ul className="mt-1.5 space-y-1.5">
            {data.mentions.slice(0, 5).map((m, i) => (
              <li key={`${m.link}-${i}`}>
                <a
                  href={m.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-medium text-slate-100 hover:text-emerald-300"
                >
                  {m.title}
                </a>
                <p className="text-[10px] text-slate-500">
                  {m.source}
                  {m.publishedAt ? ` · ${new Date(m.publishedAt).toLocaleString()}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[11px] text-slate-500">No headline links from topics.</p>
        )}
      </div>

      {data.relatedCoins.length ? (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Co-mentioned assets
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {data.relatedCoins.map((c) => (
              <li key={c}>
                <Link
                  href={coinHrefFromSymbol(c)}
                  className="rounded-full border border-slate-700 bg-slate-800/50 px-2.5 py-0.5 text-[10px] font-medium text-slate-200 hover:border-emerald-500/40 hover:text-emerald-300"
                >
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {updatedAt ? (
        <p className="text-[10px] text-slate-600">
          Refreshed {new Date(updatedAt).toLocaleString()} · Auto-refresh every hour
        </p>
      ) : null}
    </section>
  );
}
