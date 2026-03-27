"use client";

import Link from "next/link";
import { ArrowRightLeft, Goal, Shield } from "lucide-react";
import type { CopilotInsightDto, CopilotOpportunityDto } from "@/lib/copilot-api";

type Props =
  | { variant: "opportunity"; item: CopilotOpportunityDto }
  | { variant: "insight"; item: CopilotInsightDto };

function riskBadgeClass(risk: string): string {
  const r = risk.toLowerCase();
  if (r === "high") return "bg-rose-500/15 text-rose-400 border-rose-500/30";
  if (r === "low") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  return "bg-amber-500/15 text-amber-400 border-amber-500/30";
}

function confidenceBadgeClass(score: number): string {
  if (score >= 0.8) return "text-emerald-400";
  if (score >= 0.5) return "text-amber-400";
  return "text-slate-400";
}

function riskFromConfidence(score: number): string {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

export function CopilotTradeIdeaCard(props: Props) {
  if (props.variant === "opportunity") {
    const o = props.item;
    const risk = (o.risk_level ?? "medium").toLowerCase();
    const confPct = (o.confidence * 100).toFixed(0);
    return (
      <article className="flex flex-col rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-b70-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--b70-text-muted)]">
              {o.source.replace(/_/g, " ")}
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-[var(--b70-text)]">
              <Link
                href={`/radar/${encodeURIComponent(o.token_symbol)}`}
                className="hover:text-crypto-blue hover:underline"
              >
                {o.token_symbol}
              </Link>
              <span className="font-normal text-[var(--b70-text-muted)]"> · {o.title}</span>
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${riskBadgeClass(risk)}`}
            >
              Risk: {risk}
            </span>
            <span
              className={`rounded-full bg-[var(--b70-border)]/50 px-2 py-0.5 text-xs font-medium ${confidenceBadgeClass(o.confidence)}`}
              title="Model confidence"
            >
              {confPct}% confidence
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--b70-text-muted)]">{o.summary}</p>
        {(o.entry_note || o.exit_note) && (
          <div className="mt-3 space-y-2 rounded-lg border border-[var(--b70-border)]/60 bg-[var(--b70-bg)]/80 p-3 text-xs">
            {o.entry_note ? (
              <div className="flex gap-2 text-[var(--b70-text)]">
                <Goal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-crypto-blue" aria-hidden />
                <p>
                  <span className="font-medium text-[var(--b70-text-muted)]">Entry frame: </span>
                  {o.entry_note}
                </p>
              </div>
            ) : null}
            {o.exit_note ? (
              <div className="flex gap-2 text-[var(--b70-text)]">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-crypto-blue" aria-hidden />
                <p>
                  <span className="font-medium text-[var(--b70-text-muted)]">Exit / risk: </span>
                  {o.exit_note}
                </p>
              </div>
            ) : null}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
          <Link
            href={`/radar/${encodeURIComponent(o.token_symbol)}`}
            className="inline-flex items-center gap-1 text-crypto-blue hover:underline"
          >
            Radar <ArrowRightLeft className="h-3 w-3" aria-hidden />
          </Link>
          <Link
            href={`/signals/${encodeURIComponent(o.token_symbol)}`}
            className="text-crypto-blue hover:underline"
          >
            Signals
          </Link>
        </div>
      </article>
    );
  }

  const i = props.item;
  const risk = riskFromConfidence(i.confidence_score);
  const confPct = (i.confidence_score * 100).toFixed(0);
  const token = i.related_tokens?.[0];
  return (
    <article className="flex flex-col rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-b70-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--b70-text-muted)]">
            Saved insight
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-[var(--b70-text)]">{i.title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${riskBadgeClass(risk)}`}>
            Risk: {risk}
          </span>
          <span
            className={`rounded-full bg-[var(--b70-border)]/50 px-2 py-0.5 text-xs font-medium ${confidenceBadgeClass(i.confidence_score)}`}
          >
            {confPct}% confidence
          </span>
        </div>
      </div>
      {i.summary ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--b70-text-muted)]">{i.summary}</p>
      ) : null}
      <p className="mt-3 text-xs italic text-[var(--b70-text-muted)]">
        Refresh the desk for full opportunity framing (entry/exit notes) on new ideas.
      </p>
      {token ? (
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
          <Link href={`/radar/${encodeURIComponent(token)}`} className="text-crypto-blue hover:underline">
            Radar {token}
          </Link>
          <Link href={`/signals/${encodeURIComponent(token)}`} className="text-crypto-blue hover:underline">
            Signals
          </Link>
        </div>
      ) : null}
    </article>
  );
}
