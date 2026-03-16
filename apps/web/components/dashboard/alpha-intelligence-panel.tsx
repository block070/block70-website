"use client";

import { useEffect, useState } from "react";

import { getAlphaTop, getLatestBriefing, getRadarTop } from "@/lib/api";
import type { AlphaRankedOpportunity, RadarEventDto } from "@/lib/types";

type Briefing = Awaited<ReturnType<typeof getLatestBriefing>> | null;

function formatScore(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${(value * 100).toFixed(digits)}%`;
}

export function AlphaIntelligencePanel() {
  const [briefing, setBriefing] = useState<Briefing>(null);
  const [alphaTop, setAlphaTop] = useState<AlphaRankedOpportunity[]>([]);
  const [radarTop, setRadarTop] = useState<RadarEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [brief, alpha, radar] = await Promise.all([
          getLatestBriefing().catch(() => null),
          getAlphaTop(),
          getRadarTop(),
        ]);
        if (cancelled) return;
        setBriefing(brief);
        setAlphaTop(alpha ?? []);
        setRadarTop(radar ?? []);
      } catch {
        if (!cancelled) {
          setError("Unable to load alpha intelligence data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
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
        Aggregating alpha intelligence across engines…
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

  const alphaOfTheHour = alphaTop[0];
  const alphaOfTheDay = alphaTop.find(
    (e) => e.snapshot_type === "daily" || e.snapshot_type === "Alpha of the Day",
  );

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <h2 className="text-sm font-semibold text-slate-50">
        Alpha Intelligence
      </h2>
      <p className="mt-1 text-[11px] text-slate-400">
        Consolidated view of Alpha of the Hour/Day, radar clusters, and the latest
        research brief.
      </p>

      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Alpha of the Hour
          </h3>
          {alphaOfTheHour ? (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-100 line-clamp-2">
                {alphaOfTheHour.opportunity.title}
              </p>
              <p className="text-[10px] text-slate-500">
                {(alphaOfTheHour.opportunity.asset_symbol ??
                  alphaOfTheHour.opportunity.base_symbol ??
                  alphaOfTheHour.opportunity.type) || "—"}{" "}
                ·{" "}
                {formatScore(alphaOfTheHour.alpha_score, 0)}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              No ranked alpha yet for this hour.
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Alpha of the Day
          </h3>
          {alphaOfTheDay ? (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-100 line-clamp-2">
                {alphaOfTheDay.opportunity.title}
              </p>
              <p className="text-[10px] text-slate-500">
                {(alphaOfTheDay.opportunity.asset_symbol ??
                  alphaOfTheDay.opportunity.base_symbol ??
                  alphaOfTheDay.opportunity.type) || "—"}{" "}
                ·{" "}
                {formatScore(alphaOfTheDay.alpha_score, 0)}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              Daily alpha snapshot has not been generated yet.
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Top Radar Signals
          </h3>
          {radarTop.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              No strong radar clusters at the moment.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {radarTop.slice(0, 3).map((ev) => (
                <li
                  key={ev.token_symbol}
                  className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/80 px-2 py-1.5"
                >
                  <span className="text-[11px] font-medium text-slate-100">
                    {ev.token_symbol}
                  </span>
                  <span className="text-[10px] text-emerald-300">
                    {formatScore(ev.event_score, 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {briefing && (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Latest Alpha Brief
          </h3>
          <p className="mt-1 text-[11px] text-slate-200 line-clamp-3 whitespace-pre-line">
            {briefing.summary}
          </p>
        </div>
      )}
    </section>
  );
}

