"use client";

import { useEffect, useMemo, useState } from "react";

import type { Opportunity } from "@/lib/types";
import { getOpportunities } from "@/lib/api";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";

const STORAGE_KEY = "block70_watchlist_opportunity_ids";

function loadWatchlistIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "number") : [];
  } catch {
    return [];
  }
}

export default function WatchlistPage() {
  const [ids, setIds] = useState<number[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadWatchlistIds();
    setIds(stored);

    if (stored.length === 0) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const all = await getOpportunities();
        setOpportunities(all);
      } catch {
        setError(
          "Unable to load opportunities from the backend. Your watchlist will update once the API is available.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saved = useMemo(
    () => opportunities.filter((op) => ids.includes(op.id)),
    [opportunities, ids],
  );

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-slate-50">Watchlist</h2>
        <p className="mt-1 text-xs text-slate-400">
          Opportunities you&apos;ve saved to keep on your radar. This is local to your
          browser for now.
        </p>
      </section>

      {loading ? (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
          Loading your watchlist…
        </section>
      ) : error ? (
        <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">
          {error}
        </section>
      ) : ids.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
          You don&apos;t have any saved opportunities yet. Use{" "}
          <span className="font-medium text-emerald-300">Save to watchlist</span> on any
          card to pin it here.
        </section>
      ) : saved.length === 0 ? (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
          You have saved opportunities, but they aren&apos;t currently loaded from the
          backend. Try refreshing once the API is available.
        </section>
      ) : (
        <section className="space-y-3">
          {saved.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              href={`/opportunities/${opportunity.slug}`}
            />
          ))}
        </section>
      )}
    </div>
  );
}

