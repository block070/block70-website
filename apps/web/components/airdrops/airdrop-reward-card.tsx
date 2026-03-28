"use client";

import { Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Opportunity } from "@/lib/types";
import {
  deriveChecklistSteps,
  formatAirdropTimeEstimate,
  formatAirdropValueLine,
  formatDifficultyPresentation,
  isNewOpportunity,
  AIRDROP_NEW_DAYS_DEFAULT,
} from "@/lib/airdrop-present";

const STORAGE_KEY = "b70-airdrop-checklist";

type ChecklistMap = Record<string, number[]>;

function readMap(): ChecklistMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    return p && typeof p === "object" && !Array.isArray(p) ? (p as ChecklistMap) : {};
  } catch {
    return {};
  }
}

function writeStep(slug: string, stepIndex: number, completed: boolean) {
  const map = readMap();
  const cur = new Set(map[slug] ?? []);
  if (completed) cur.add(stepIndex);
  else cur.delete(stepIndex);
  map[slug] = [...cur].sort((a, b) => a - b);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

type Props = {
  opportunity: Opportunity;
};

export function AirdropRewardCard({ opportunity }: Props) {
  const steps = useMemo(
    () => deriveChecklistSteps(opportunity),
    [opportunity],
  );
  const [done, setDone] = useState<Set<number>>(() => new Set());

  const slug = opportunity.slug;

  useEffect(() => {
    const map = readMap();
    setDone(new Set(map[slug] ?? []));
  }, [slug]);

  const toggle = useCallback(
    (index: number) => {
      const next = new Set(done);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      setDone(next);
      writeStep(slug, index, next.has(index));
    },
    [done, slug],
  );

  const { primary: valueLine, isEstimate } = formatAirdropValueLine(opportunity);
  const isNew = isNewOpportunity(
    opportunity.detected_at,
    AIRDROP_NEW_DAYS_DEFAULT,
  );
  const relevancePct = Math.round(opportunity.total_score * 100);

  return (
    <article className="flex flex-col rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm transition-colors hover:border-slate-600">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href={`/opportunities/${opportunity.slug}`}
            className="text-base font-semibold text-[var(--b70-text)] hover:text-[var(--b70-crypto-blue)]"
          >
            {opportunity.title}
          </Link>
          {opportunity.asset_symbol ? (
            <p className="mt-0.5 font-mono text-xs text-[var(--b70-text-muted)]">
              {opportunity.asset_symbol}
            </p>
          ) : null}
        </div>
        {isNew ? (
          <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
            New
          </span>
        ) : null}
      </div>

      <dl className="mt-3 grid gap-2 text-xs text-[var(--b70-text-muted)]">
        <div className="flex justify-between gap-4">
          <dt className="shrink-0 text-[var(--b70-text-muted)]">Value</dt>
          <dd className="text-right text-[var(--b70-text)]">
            {valueLine}
            {isEstimate ? (
              <span className="ml-1 text-[10px] text-[var(--b70-text-muted)]">
                (not guaranteed)
              </span>
            ) : null}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="shrink-0">Effort</dt>
          <dd className="text-right text-[var(--b70-text)]">
            {formatDifficultyPresentation(opportunity)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="shrink-0">Time (rough)</dt>
          <dd className="text-right text-[var(--b70-text)]">
            {formatAirdropTimeEstimate(opportunity)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="shrink-0">Listing relevance</dt>
          <dd className="text-right text-[var(--b70-text)]" title="Heuristic ranking in our feed, not probability of an airdrop or profit.">
            {relevancePct}%
          </dd>
        </div>
        {opportunity.source ? (
          <div className="flex justify-between gap-4">
            <dt className="shrink-0">Source</dt>
            <dd className="text-right text-[var(--b70-text)]">
              {opportunity.source}
            </dd>
          </div>
        ) : null}
      </dl>

      {opportunity.source_ref ? (
        <a
          href={opportunity.source_ref}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--b70-crypto-blue)] hover:underline"
        >
          Open primary link
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ) : null}

      <div className="mt-4 border-t border-[var(--b70-border)] pt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--b70-text-muted)]">
          Checklist (saved on this device)
        </p>
        <ul className="mt-2 space-y-2">
          {steps.map((step, index) => {
            const checked = done.has(index);
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className="flex w-full items-start gap-2 rounded-lg border border-transparent px-1 py-1 text-left text-xs text-[var(--b70-text)] hover:bg-slate-800/40"
                >
                  <span
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                        : "border-slate-600 bg-slate-900/80"
                    }`}
                  >
                    {checked ? <Check className="size-3" strokeWidth={2.5} /> : null}
                  </span>
                  <span className={checked ? "text-[var(--b70-text-muted)] line-through" : ""}>
                    {step.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Link
        href={`/opportunities/${opportunity.slug}`}
        className="mt-4 text-center text-xs font-medium text-[var(--b70-crypto-blue)] hover:underline"
      >
        Full detail
      </Link>
    </article>
  );
}
