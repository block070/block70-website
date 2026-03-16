"use client";

import { useEffect, useState } from "react";

import { getLatestBriefing } from "@/lib/api";

type Briefing = Awaited<ReturnType<typeof getLatestBriefing>>;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function DailyBriefingPanel() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const latest = await getLatestBriefing();
        if (cancelled) return;
        setBriefing(latest);
      } catch {
        if (!cancelled) {
          setError(
            "Unable to load the latest intelligence briefing from the backend.",
          );
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
        Assembling today&apos;s crypto intelligence brief…
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

  if (!briefing) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        No daily briefing is available yet. Once the engine has enough data to
        summarize, today&apos;s readout will appear here.
      </section>
    );
  }

  const topOpps = Array.isArray(briefing.top_opportunities)
    ? briefing.top_opportunities
    : [];
  const topTokens = Array.isArray(briefing.top_tokens)
    ? briefing.top_tokens
    : [];
  const radar = Array.isArray(briefing.radar_events)
    ? briefing.radar_events
    : [];

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-50">
            Daily Intelligence Briefing
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Synthesized view of what matters today across Block70&apos;s
            engines.
          </p>
        </div>
        <div className="text-right text-[10px] text-slate-500">
          <p>{formatDate(briefing.created_at)}</p>
          {briefing.market_sentiment && (
            <p className="mt-0.5">
              Sentiment:{" "}
              <span className="font-semibold text-slate-200">
                {briefing.market_sentiment}
              </span>
            </p>
          )}
        </div>
      </header>

      <div className="mt-3 space-y-3">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Summary
          </h4>
          <p className="mt-1 text-xs text-slate-200 whitespace-pre-line">
            {briefing.summary}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Top Opportunities
            </h4>
            {topOpps.length === 0 ? (
              <p className="mt-1 text-[11px] text-slate-500">
                No standout opportunities captured in today&apos;s brief.
              </p>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {topOpps.slice(0, 5).map((op: any) => (
                  <li
                    key={op.id ?? op.title}
                    className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/80 px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-slate-100">
                        {op.title}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {(op.token ?? op.asset_symbol ?? op.type) || "—"} ·{" "}
                        {op.type}
                      </p>
                    </div>
                    {typeof op.total_score === "number" && (
                      <span className="shrink-0 text-[10px] font-semibold text-emerald-300">
                        {(op.total_score * 100).toFixed(0)}%
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Top Tokens & Radar
            </h4>

            {topTokens.length === 0 && radar.length === 0 ? (
              <p className="mt-1 text-[11px] text-slate-500">
                No strong token clusters or radar activity highlighted today.
              </p>
            ) : (
              <div className="mt-1 space-y-2">
                {topTokens.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-300">
                      Top Tokens
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {topTokens.slice(0, 6).map((t: any) => (
                        <span
                          key={t.token_symbol}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-200"
                        >
                          <span className="font-mono font-semibold">
                            {t.token_symbol}
                          </span>
                          {typeof t.signal_count === "number" && (
                            <span className="text-slate-500">
                              ×{t.signal_count}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {radar.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-300">
                      Radar Signals
                    </p>
                    <ul className="mt-1 space-y-1">
                      {radar.slice(0, 4).map((ev: any) => (
                        <li
                          key={ev.id}
                          className="rounded border border-slate-800 bg-slate-950/80 px-2 py-1 text-[10px] text-slate-300"
                        >
                          <span className="font-mono text-slate-100">
                            {ev.token_symbol ?? "N/A"}
                          </span>{" "}
                          <span className="text-slate-500">
                            · {ev.signal_type}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

