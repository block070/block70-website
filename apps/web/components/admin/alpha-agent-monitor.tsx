"use client";

import { useEffect, useState } from "react";

type AgentRun = {
  id: string;
  agent_name: string;
  run_status: "success" | "partial" | "failed";
  opportunities_processed: number;
  signals_processed: number;
  run_summary: string;
  started_at: string;
  completed_at: string | null;
};

const MOCK_RUNS: AgentRun[] = [
  {
    id: "1",
    agent_name: "opportunity_hunter",
    run_status: "success",
    opportunities_processed: 12,
    signals_processed: 84,
    run_summary: "Surfaced new candidate projects from dev + social activity.",
    started_at: new Date(Date.now() - 28 * 60_000).toISOString(),
    completed_at: new Date(Date.now() - 25 * 60_000).toISOString(),
  },
  {
    id: "2",
    agent_name: "alpha_research",
    run_status: "success",
    opportunities_processed: 7,
    signals_processed: 0,
    run_summary: "Generated AI analyses and research reports for fresh alpha.",
    started_at: new Date(Date.now() - 22 * 60_000).toISOString(),
    completed_at: new Date(Date.now() - 18 * 60_000).toISOString(),
  },
  {
    id: "3",
    agent_name: "trade_simulation",
    run_status: "partial",
    opportunities_processed: 5,
    signals_processed: 0,
    run_summary: "Simulated trades for recent opps; 1 timed out on price data.",
    started_at: new Date(Date.now() - 16 * 60_000).toISOString(),
    completed_at: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  {
    id: "4",
    agent_name: "alpha_orchestrator",
    run_status: "success",
    opportunities_processed: 24,
    signals_processed: 140,
    run_summary: "Coordinated hunter, research, simulation, ranking, reporting.",
    started_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    completed_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  },
];

function formatTime(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AlphaAgentMonitor() {
  const [runs, setRuns] = useState<AgentRun[]>([]);

  useEffect(() => {
    // For now, use mock runs to visualize the admin view. This can be wired
    // to a real AlphaAgentRun API once available.
    setRuns(MOCK_RUNS);
  }, []);

  if (!runs.length) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        No Alpha Agent runs recorded yet.
      </section>
    );
  }

  const lastRun = runs[0];

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-50">
            Alpha Agent Activity
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            High-level view of recent autonomous alpha runs across hunter,
            research, simulation, and ranking agents.
          </p>
        </div>
        <div className="text-right text-[10px] text-slate-500">
          <p>Last orchestrator status:</p>
          <p className="mt-0.5 font-semibold text-emerald-300">
            {lastRun.run_status.toUpperCase()}
          </p>
        </div>
      </header>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-800">
        <table className="min-w-full border-collapse text-[11px]">
          <thead className="bg-slate-950/80 text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Agent</th>
              <th className="px-3 py-2 text-left">Summary</th>
              <th className="px-3 py-2 text-right">Opps</th>
              <th className="px-3 py-2 text-right">Signals</th>
              <th className="px-3 py-2 text-right">Status</th>
              <th className="px-3 py-2 text-right">Completed</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr
                key={run.id}
                className="border-t border-slate-800/80 bg-slate-950/80"
              >
                <td className="px-3 py-2 align-middle font-mono text-[10px] text-slate-300">
                  {run.agent_name}
                </td>
                <td className="px-3 py-2 align-middle text-slate-200">
                  <span className="line-clamp-2">{run.run_summary}</span>
                </td>
                <td className="px-3 py-2 align-middle text-right text-slate-200">
                  {run.opportunities_processed}
                </td>
                <td className="px-3 py-2 align-middle text-right text-slate-200">
                  {run.signals_processed}
                </td>
                <td className="px-3 py-2 align-middle text-right">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      run.run_status === "success"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : run.run_status === "partial"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {run.run_status}
                  </span>
                </td>
                <td className="px-3 py-2 align-middle text-right text-slate-400">
                  {formatTime(run.completed_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

