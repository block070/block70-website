"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { getCopilotInsights, type CopilotInsightDto } from "@/lib/copilot-api";
import { CopilotAlert } from "@/components/copilot/copilot-alert";
import { Filter, LayoutTemplate } from "lucide-react";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "market_alert", label: "Market" },
  { id: "narrative_alert", label: "Narratives" },
  { id: "opportunity_alert", label: "Opportunities" },
  { id: "portfolio_alert", label: "Portfolio" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export default function CopilotFeedPage() {
  const [insights, setInsights] = useState<CopilotInsightDto[]>([]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuth = typeof window !== "undefined" && !!getToken();

  useEffect(() => {
    if (!isAuth) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    getCopilotInsights({ limit: 50 })
      .then((data) => {
        if (!cancelled) setInsights(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuth]);

  const filtered = useMemo(() => {
    if (filter === "all") return insights;
    return insights.filter((i) => i.insight_type === filter);
  }, [insights, filter]);

  if (!isAuth) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex items-center gap-2 text-xs font-medium text-crypto-blue">
          <LayoutTemplate className="h-3.5 w-3.5" aria-hidden />
          Insight feed
        </div>
        <h1 className="text-2xl font-semibold text-[var(--b70-text)]">Assistant feed</h1>
        <p className="text-sm text-[var(--b70-text-muted)]">Log in to see your personalized stream.</p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-crypto-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-crypto-blue">
            <LayoutTemplate className="h-3.5 w-3.5" aria-hidden />
            AI assistant
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--b70-text)]">Insight feed</h1>
          <p className="mt-2 text-sm text-[var(--b70-text-muted)]">
            Chronological stream of desk-generated alerts. Filter by lane.
          </p>
        </div>
        <Link
          href="/copilot"
          className="shrink-0 rounded-lg border border-[var(--b70-border)] px-3 py-2 text-xs font-medium text-[var(--b70-text)] hover:bg-[var(--b70-border)]"
        >
          Back to desk
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-3">
        <span className="flex items-center gap-1 text-xs font-medium text-[var(--b70-text-muted)]">
          <Filter className="h-3.5 w-3.5" aria-hidden />
          View
        </span>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              filter === f.id
                ? "bg-crypto-blue/20 text-crypto-blue"
                : "text-[var(--b70-text-muted)] hover:bg-[var(--b70-border)] hover:text-[var(--b70-text)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">{error}</div>
      ) : loading ? (
        <p className="text-sm text-[var(--b70-text-muted)]">Loading feed…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--b70-text-muted)]">
          {insights.length === 0
            ? "No insights yet. Open the desk and run Refresh desk."
            : "Nothing in this lane—try another filter."}
        </p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((i) => (
            <li key={i.id}>
              <CopilotAlert insight={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
