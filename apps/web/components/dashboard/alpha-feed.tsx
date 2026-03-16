"use client";

import { useEffect, useState } from "react";

import type { AlphaEvent } from "@/lib/types";
import { getAlphaFeed } from "@/lib/api";

function formatTime(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatConfidence(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "–";
  return `${(score * 100).toFixed(0)}%`;
}

function eventLabel(ev: AlphaEvent): string {
  switch (ev.event_type) {
    case "arbitrage_detected":
      return "Arb";
    case "whale_buy":
      return "Whale";
    case "miner_roi_spike":
      return "Miner";
    case "trend_signal":
      return "Trend";
    default:
      return ev.event_type;
  }
}

export function AlphaFeed() {
  const [events, setEvents] = useState<AlphaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getAlphaFeed(50);
        if (cancelled) return;
        setEvents(data);
      } catch {
        if (!cancelled) {
          setError("Unable to load the alpha feed from the backend.");
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
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400">
        Streaming alpha feed…
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-3 text-[11px] text-rose-100">
        {error}
      </section>
    );
  }

  if (!events.length) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400">
        No alpha events yet. As the engine detects arbitrage, whale moves, miner
        spikes, and trend shifts, they&apos;ll scroll through here.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 text-[11px] text-slate-200 shadow-lg shadow-black/40">
      <header className="flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-950 to-emerald-900/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
            Alpha Feed
          </span>
        </div>
        <span className="text-[10px] text-slate-400">
          Live crypto intelligence ticker
        </span>
      </header>

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-slate-950 to-transparent" />
        <ul className="max-h-64 space-y-1 overflow-auto px-3 py-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex items-start gap-3 rounded-lg border border-slate-900/80 bg-slate-950/80 px-2 py-1.5"
            >
              <span
                className="mt-0.5 inline-flex min-w-[44px] items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300"
              >
                {eventLabel(ev)}
              </span>
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {ev.token_symbol ? (
                      <span className="font-semibold text-slate-50">
                        {ev.token_symbol}
                      </span>
                    ) : null}
                    {ev.chain ? (
                      <span className="rounded-full border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-[9px] uppercase tracking-wide text-slate-400">
                        {ev.chain}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {formatTime(ev.created_at)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-200">{ev.summary}</p>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>
                    Confidence{" "}
                    <span className="font-semibold text-emerald-300">
                      {formatConfidence(ev.confidence_score)}
                    </span>
                  </span>
                  {ev.source ? (
                    <span className="text-slate-500">
                      Source:{" "}
                      <span className="font-medium text-slate-300">
                        {ev.source}
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

