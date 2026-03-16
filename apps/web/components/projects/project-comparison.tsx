"use client";

import type { CandidateProject } from "@/lib/types";

type Props = {
  projects: CandidateProject[];
};

function formatPercent(value: number, digits = 0): string {
  if (Number.isNaN(value)) return "–";
  return `${(value * 100).toFixed(digits)}%`;
}

function computePotentialOpportunityScore(
  dev: number,
  social: number,
  confidence: number,
): number {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const d = clamp(dev);
  const s = clamp(social);
  const c = clamp(confidence);
  return clamp(d * 0.4 + s * 0.35 + c * 0.25);
}

export function ProjectComparison({ projects }: Props) {
  if (!projects.length) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        Select at least two candidate projects to compare their traction
        profiles side by side.
      </section>
    );
  }

  const withScores = projects.map((p) => {
    const potential = computePotentialOpportunityScore(
      p.dev_activity_score,
      p.social_activity_score,
      p.confidence_score,
    );
    return { ...p, potential_opportunity_score: potential };
  });

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold text-slate-50">
        Project Comparison
      </h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Compare developer traction, social heat, confidence, and composite
        opportunity score across candidate projects.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse text-[11px]">
          <thead className="bg-slate-950/80 text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-3 py-2 text-left">Token</th>
              <th className="px-3 py-2 text-right">Dev Activity</th>
              <th className="px-3 py-2 text-right">Social Activity</th>
              <th className="px-3 py-2 text-right">Confidence</th>
              <th className="px-3 py-2 text-right">Potential Score</th>
            </tr>
          </thead>
          <tbody>
            {withScores.map((p) => (
              <tr
                key={p.id}
                className="border-t border-slate-800/80 bg-slate-950/70"
              >
                <td className="px-3 py-2 align-middle text-slate-100">
                  <span className="line-clamp-2">{p.project_name}</span>
                </td>
                <td className="px-3 py-2 align-middle font-mono text-slate-300">
                  {p.token_symbol ?? "—"}
                </td>
                <td className="px-3 py-2 align-middle text-right text-emerald-300">
                  {formatPercent(p.dev_activity_score)}
                </td>
                <td className="px-3 py-2 align-middle text-right text-emerald-300">
                  {formatPercent(p.social_activity_score)}
                </td>
                <td className="px-3 py-2 align-middle text-right text-emerald-200">
                  {formatPercent(p.confidence_score)}
                </td>
                <td className="px-3 py-2 align-middle text-right font-semibold text-emerald-300">
                  {formatPercent(p.potential_opportunity_score, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

