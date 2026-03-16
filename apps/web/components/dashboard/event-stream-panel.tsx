"use client";

import { useEffect, useState } from "react";

import { getEventStats, getRecentEvents } from "@/lib/events";

type StreamEventDto = Awaited<ReturnType<typeof getRecentEvents>>[number];

export function EventStreamPanel() {
  const [events, setEvents] = useState<StreamEventDto[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getEventStats>> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [recent, s] = await Promise.all([
          getRecentEvents(40),
          getEventStats(6),
        ]);
        if (cancelled) return;
        setEvents(recent);
        setStats(s);
      } catch {
        if (!cancelled) {
          setError("Unable to load streaming event activity.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    const interval = setInterval(() => {
      void load();
    }, 15_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
        Streaming engine warming up…
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

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-50">Streaming Events</h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Live tape of wallet trades, price updates, DEX activity, and social/dev
            signals flowing through the Block70 stream.
          </p>
        </div>
        {stats ? (
          <div className="flex gap-3 text-[11px] text-slate-300">
            <div className="flex flex-col items-end">
              <span className="text-slate-400">Events (last {stats.window_hours}h)</span>
              <span className="text-sm font-semibold text-emerald-300">
                {stats.total_events}
              </span>
            </div>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-slate-400">Top type</span>
              <span className="text-[11px] text-slate-200">
                {Object.keys(stats.by_type || {}).sort(
                  (a, b) => (stats.by_type[b] ?? 0) - (stats.by_type[a] ?? 0),
                )[0] ?? "n/a"}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {events.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-4 text-[11px] text-slate-400">
          No recent streaming events yet. Once connectors start publishing wallet
          trades, price updates, and radar signals, they&apos;ll appear here.
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {events.map((ev) => {
            const label = ev.event_type;
            const kind = ev.event_type;

            let badgeClass =
              "border border-slate-700 bg-slate-900 text-slate-200";
            if (kind === "wallet_transaction") {
              badgeClass =
                "border border-sky-500/60 bg-sky-500/10 text-sky-300";
            } else if (kind === "price_update") {
              badgeClass =
                "border border-emerald-500/60 bg-emerald-500/10 text-emerald-300";
            } else if (kind === "dex_trade" || kind === "liquidity_change") {
              badgeClass =
                "border border-amber-500/60 bg-amber-500/10 text-amber-300";
            } else if (kind === "dev_activity" || kind === "social_signal") {
              badgeClass =
                "border border-purple-500/60 bg-purple-500/10 text-purple-300";
            }

            const created = new Date(ev.created_at);

            return (
              <li
                key={ev.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2"
              >
                <div className="space-y-0.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}
                  >
                    {label}
                  </span>
                  <p className="text-[11px] text-slate-200">
                    {ev.token_symbol ?? "—"}{" "}
                    {ev.chain ? `· ${ev.chain.toUpperCase()}` : ""}
                  </p>
                  <p className="max-w-[260px] truncate text-[10px] font-mono text-slate-500">
                    {typeof ev.payload === "string"
                      ? ev.payload
                      : JSON.stringify(ev.payload)}
                  </p>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  {created.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

