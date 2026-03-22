import Link from "next/link";
import { getRadarList, getRadarTop } from "@/lib/api";
import type { RadarEventDto } from "@/lib/types";
import { withTimeout } from "@/lib/with-timeout";

export const revalidate = 60;

function formatScore(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "–";
  return `${(v * 100).toFixed(0)}%`;
}

export default async function RadarDashboardPage() {
  let list: RadarEventDto[] = [];
  let top: RadarEventDto[] = [];

  try {
    [list, top] = await Promise.all([
      withTimeout(getRadarList({ hours: 24 }), 8_000, []),
      withTimeout(getRadarTop(), 8_000, []),
    ]);
  } catch {
    // use empty
  }

  const events = list.length ? list : top;
  const hasSeverity = events.some((e) => "severity_score" in e);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Market radar
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Real-time anomaly alerts: volume spikes, liquidity changes, price
          breakouts.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <h2 className="text-sm font-semibold text-slate-50">
            Top radar events (24h)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Highest-scoring aggregated and persisted events
          </p>
          {top.length === 0 ? (
            <p className="mt-4 text-xs text-slate-500">
              No radar events in the window. Events appear as the engine
              detects anomalies.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {top.slice(0, 8).map((ev, i) => (
                <li key={i}>
                  <Link
                    href={`/radar/${encodeURIComponent(String(ev.token_symbol ?? ""))}`}
                    className="block rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs hover:bg-slate-800"
                  >
                    <span className="font-medium text-slate-200">
                      {String(ev.token_symbol ?? "—")}
                    </span>
                    {hasSeverity && "severity_score" in ev && (
                      <span className="ml-2 text-emerald-400">
                        {formatScore(ev.severity_score as number)}
                      </span>
                    )}
                    {"event_score" in ev && (
                      <span className="ml-2 text-emerald-400">
                        score {formatScore(ev.event_score as number)}
                      </span>
                    )}
                    {"event_type" in ev && (
                      <span className="ml-2 text-slate-500">
                        {String(ev.event_type)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <h2 className="text-sm font-semibold text-slate-50">
            All radar (24h)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Persisted anomalies and aggregated signals
          </p>
          {events.length === 0 ? (
            <p className="mt-4 text-xs text-slate-500">
              No events. Check back after the radar pipeline runs.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {events.slice(0, 8).map((ev, i) => (
                <li key={i} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs">
                  <span className="font-mono text-slate-300">
                    {String(ev.token_symbol ?? "—")}
                  </span>
                  {ev.description != null && ev.description !== "" && (
                    <p className="mt-1 text-slate-500">
                      {String(ev.description)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <Link
          href="/signals"
          className="text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          View signals feed →
        </Link>
      </section>
    </div>
  );
}
