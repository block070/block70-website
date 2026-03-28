import { getOpportunities, getRadarEventsForToken, getSignalsForToken } from "@/lib/api";
import type { Opportunity, RadarEventDto } from "@/lib/types";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { RadarTimeline } from "@/components/radar/radar-timeline";

type PageProps = {
  params: { token: string };
};

function formatScore(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function RadarTokenPage({ params }: PageProps) {
  const token = params.token.toUpperCase();

  let events: RadarEventDto[] = [];
  let opportunities: Opportunity[] = [];
  let error: string | null = null;
  let granularError: string | null = null;
  let timelineSignals: {
    timestamp: string;
    signal_type: string;
    description?: string;
    source?: string;
    strength?: number;
  }[] = [];

  try {
    const [eventsResp, oppsResp] = await Promise.all([
      getRadarEventsForToken(token),
      getOpportunities(),
    ]);
    events = eventsResp ?? [];
    opportunities = oppsResp ?? [];
  } catch {
    error =
      "Unable to load radar details for this token right now. Please try again shortly.";
  }

  try {
    const signalsResp = await getSignalsForToken(token, { limit: 40 });
    timelineSignals = signalsResp.map((s) => ({
      timestamp: s.created_at,
      signal_type: s.signal_type,
      description: s.description ?? s.title ?? undefined,
      source: s.source ?? undefined,
      strength: s.signal_strength,
    }));
  } catch {
    granularError =
      "Granular signal timeline unavailable (signals API). Summaries below still apply when present.";
  }

  const bestEvent = events[0] ?? null;
  const relatedOpportunities = opportunities
    .filter(
      (op) =>
        (op.asset_symbol ?? op.base_symbol)?.toUpperCase() === token &&
        op.status === "active",
    )
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">
            Radar · {token}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Aggregated crypto radar view for {token}, combining wallet,
            liquidity, developer, and narrative signals.
          </p>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-xs text-rose-100">
          {error}
        </section>
      ) : null}

      {granularError && !error ? (
        <section className="rounded-xl border border-amber-800/50 bg-amber-950/30 p-3 text-xs text-amber-100/90">
          {granularError}
        </section>
      ) : null}

      <RadarTimeline signals={timelineSignals} />

      {bestEvent ? (
        <section className="rounded-xl border border-emerald-500/60 bg-slate-950/80 p-4 text-xs text-slate-200">
          <h3 className="text-sm font-semibold text-slate-50">
            Event Summary
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Radar score{" "}
            <span className="font-semibold text-emerald-300">
              {formatScore(bestEvent.event_score, 0)}
            </span>{" "}
            with confidence{" "}
            <span className="font-semibold text-emerald-200">
              {formatScore(bestEvent.avg_confidence_score, 0)}
            </span>
            . Latest signal at{" "}
            <span className="font-medium text-slate-100">
              {formatTime(bestEvent.latest_signal_at)}
            </span>
            .
          </p>
          <p className="mt-2 text-[11px] text-slate-300">
            Signals detected: {bestEvent.signal_count} · Types:{" "}
            {(bestEvent.signal_types ?? []).join(", ") || "n/a"}.
          </p>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
          No radar events have been recorded for {token} in the recent window.
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-200">
          <h3 className="text-sm font-semibold text-slate-50">
            Supporting Signals
          </h3>
          {bestEvent ? (
            <ul className="mt-2 space-y-1.5">
              {(bestEvent.signal_types ?? []).map((type) => (
                <li key={type} className="flex items-center justify-between">
                  <span className="capitalize text-[11px] text-slate-300">
                    {type.replace(/_/g, " ")}
                  </span>
                </li>
              ))}
              {(bestEvent.signal_types ?? []).length === 0 && (
                <li className="text-[11px] text-slate-500">
                  No specific signal types recorded.
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-slate-500">
              No radar signals available for this token.
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-200">
          <h3 className="text-sm font-semibold text-slate-50">
            Timeline & Confidence
          </h3>
          {bestEvent ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Latest signal
                </span>
                <span className="text-[11px] font-medium text-slate-100">
                  {formatTime(bestEvent.latest_signal_at)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Radar score
                </span>
                <span className="text-[11px] font-semibold text-emerald-300">
                  {formatScore(bestEvent.event_score, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Confidence
                </span>
                <span className="text-[11px] font-semibold text-emerald-200">
                  {formatScore(bestEvent.avg_confidence_score, 0)}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-slate-500">
              No recent radar activity for this token.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-50">
          Related Opportunities
        </h3>
        {relatedOpportunities.length === 0 ? (
          <p className="text-xs text-slate-500">
            No active opportunities currently match this token. As Block70
            normalizes more alpha, they&apos;ll show up here.
          </p>
        ) : (
          relatedOpportunities.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              href={`/opportunities/${opportunity.slug}`}
            />
          ))
        )}
      </section>
    </div>
  );
}

