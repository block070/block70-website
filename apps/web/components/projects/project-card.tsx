"use client";

import type { CandidateProject } from "@/lib/types";

type Props = {
  project: CandidateProject;
};

function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${(value * 100).toFixed(digits)}%`;
}

export function ProjectCard({ project }: Props) {
  const {
    project_name,
    token_symbol,
    dev_activity_score,
    social_activity_score,
    confidence_score,
    description,
    source,
  } = project;

  return (
    <article className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200 shadow-sm shadow-black/30">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-50">
            {project_name}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {token_symbol ?? "Unmapped token"}{" "}
            {source ? `· Sourced via ${source}` : ""}
          </p>
        </div>
      </header>

      <p className="mt-2 line-clamp-3 text-[11px] text-slate-300">
        {description ??
          "Potential new project detected by the Opportunity Hunter based on developer and social traction."}
      </p>

      <dl className="mt-3 grid grid-cols-3 gap-3 text-[10px]">
        <div>
          <dt className="uppercase tracking-wide text-slate-500">
            Dev Activity
          </dt>
          <dd className="mt-0.5 text-sm font-semibold text-emerald-300">
            {formatPercent(dev_activity_score, 0)}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-slate-500">
            Social Activity
          </dt>
          <dd className="mt-0.5 text-sm font-semibold text-emerald-300">
            {formatPercent(social_activity_score, 0)}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-slate-500">
            Confidence
          </dt>
          <dd className="mt-0.5 text-sm font-semibold text-emerald-200">
            {formatPercent(confidence_score, 0)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

