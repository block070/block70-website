"use client";

import Link from "next/link";
import { Fish, NotebookTabs } from "lucide-react";
import type { CopilotInsightDto } from "@/lib/copilot-api";
import { CopilotAlert } from "@/components/copilot/copilot-alert";

type Props = {
  narrativeAlerts: CopilotInsightDto[];
  whaleAlerts: CopilotInsightDto[];
};

export function CopilotAlertsStrip({ narrativeAlerts, whaleAlerts }: Props) {
  return (
    <section className="rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5 shadow-b70-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-crypto-blue">
            <NotebookTabs className="h-3.5 w-3.5" aria-hidden />
            Alert center
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--b70-text)]">Alerts</h2>
          <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
            Narrative shifts and whale-style activity surfaced for your book.
          </p>
        </div>
        <Link
          href="/alerts"
          className="rounded-lg border border-[var(--b70-border)] px-3 py-2 text-xs font-medium text-[var(--b70-text)] hover:bg-[var(--b70-border)]"
        >
          Notification inbox
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
            <NotebookTabs className="h-3.5 w-3.5" aria-hidden />
            Narrative shifts
          </div>
          {narrativeAlerts.length ? (
            <div className="grid gap-3">
              {narrativeAlerts.slice(0, 4).map((i) => (
                <CopilotAlert key={i.id} insight={i} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--b70-text-muted)]">
              No narrative alerts—generate insights to pull theme momentum.
            </p>
          )}
        </div>
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
            <Fish className="h-3.5 w-3.5" aria-hidden />
            Whale activity
          </div>
          {whaleAlerts.length ? (
            <div className="grid gap-3">
              {whaleAlerts.slice(0, 4).map((i) => (
                <CopilotAlert key={i.id} insight={i} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--b70-text-muted)]">
              No whale overlap alerts yet—refresh when smart-money signals land on your names.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
