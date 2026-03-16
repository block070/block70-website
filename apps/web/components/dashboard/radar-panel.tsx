"use client";

import { useEffect, useState } from "react";

import type { RadarEventDto } from "@/lib/types";
import { getRadarTop } from "@/lib/api";

function formatScore(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RadarPanel() {
  const [events, setEvents] = useState<RadarEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getRadarTop();
        if (cancelled) return;
        setEvents(data ?? []);
      } catch {
        if (!cancelled) {
          setError("Unable to load radar signals from the backend.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        Scanning the tape for concentrated on-chain activity…
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-xs text-rose-100">
        {error}
      </section>
    );
  }

  if (!events.length) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        No strong radar clusters detected yet. As wallets, DEXs, and developers
        converge on the same tokens, they&apos;ll light up here.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold text-slate-50">Crypto Radar</h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Aggregated signals across wallets, DEX volume, dev activity, and
        narratives. Higher scores mean more aligned, recent activity.
      </p>

      <div className="mt-3 space-y-1.5">
        {events.slice(0, 10).map((ev, idx) => {
          const isTop = idx === 0;
          const badgeClass = isTop
            ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-300"
            : "border-slate-700 bg-slate-900/80 text-slate-200";

          const summary = buildSummary(ev);

          return (
            <div
              key={`${ev.token_symbol}-${idx}`}
              className={`flex items-start justify-between gap-3 rounded-lg border bg-slate-950/80 px-3 py-2 ${
                isTop ? "border-emerald-500/60 shadow-md shadow-emerald-500/25" : "border-slate-800"
              }`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}
                >
                  {ev.token_symbol}
                </span>
                <div className="space-y-0.5">
                  <p className="text-[11px] font-medium text-slate-100">
                    {summary}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Signals: {ev.signal_count ?? 0} · Types:{" "}
                    {(ev.signal_types ?? []).join(", ") || "n/a"}
                  </p>
                </div>
              </div>

              <div className="text-right text-[10px] text-slate-400">
                <p>
                  Radar{" "}
                  <span className="font-semibold text-emerald-300">
                    {formatScore(ev.event_score, 0)}
                  </span>
                </p>
                <p>
                  Conf{" "}
                  <span className="font-semibold text-emerald-200">
                    {formatScore(ev.avg_confidence_score, 0)}
                  </span>
                </p>
                <p className="mt-0.5">
                  {formatTime(ev.latest_signal_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function buildSummary(ev: RadarEventDto): string {
  const pieces: string[] = [];

  if ((ev.signal_types ?? []).includes("wallet_accumulation")) {
    pieces.push("whale accumulation pressure");
  }
  if ((ev.signal_types ?? []).includes("dex_volume_spike")) {
    pieces.push("elevated DEX flow");
  }
  if ((ev.signal_types ?? []).includes("liquidity_increase")) {
    pieces.push("liquidity stepping higher");
  }
  if ((ev.signal_types ?? []).includes("dev_activity_spike")) {
    pieces.push("builder activity picking up");
  }
  if ((ev.signal_types ?? []).includes("social_mentions_spike")) {
    pieces.push("social narrative heating up");
  }

  if (!pieces.length) {
    return `${ev.token_symbol} has a concentrated cluster of recent signals.`;
  }

  const core = pieces.length === 1
    ? pieces[0]
    : pieces.slice(0, -1).join(", ") + " and " + pieces[pieces.length - 1];

  return `${ev.token_symbol} showing ${core}.`;
}

