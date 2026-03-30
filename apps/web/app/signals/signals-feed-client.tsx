"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getSignals,
  getSignalsLatest,
  type SignalsFilter,
} from "@/lib/api";
import type { SignalDto } from "@/lib/types";
import { SignalCard } from "@/components/signals/signal-card";
import { getCurrentUser } from "@/lib/auth";
import { signalsFeedTier, type SignalsFeedTier } from "@/lib/plan-tier";
import {
  SignalFilters,
  type SignalFiltersValue,
} from "@/components/signals/signal-filters";

const DEFAULT_FILTERS: SignalFiltersValue = {
  chain: "",
  signal_type: "",
  confidence_min: "",
  token: "",
};

type Props = {
  initialSignals: SignalDto[];
};

function applyFilters(signals: SignalDto[], filters: SignalFiltersValue): SignalDto[] {
  let out = signals;
  if (filters.chain) {
    out = out.filter((s) => (s.chain || "").toLowerCase() === filters.chain.toLowerCase());
  }
  if (filters.signal_type) {
    out = out.filter((s) => s.signal_type === filters.signal_type);
  }
  if (filters.token) {
    const t = filters.token.trim().toLowerCase();
    out = out.filter(
      (s) =>
        (s.token_symbol || "").toLowerCase().includes(t) ||
        (s.token_address || "").toLowerCase().includes(t),
    );
  }
  const minConf = parseFloat(filters.confidence_min);
  if (!Number.isNaN(minConf) && minConf > 0) {
    out = out.filter((s) => (s.confidence_score ?? 0) * 100 >= minConf);
  }
  return out;
}

export function SignalsFeedClient({ initialSignals }: Props) {
  const [signals, setSignals] = useState<SignalDto[]>(initialSignals);
  const [filters, setFilters] = useState<SignalFiltersValue>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedTier, setFeedTier] = useState<
    "loading" | SignalsFeedTier
  >("loading");

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const hasFilters =
        filters.chain || filters.signal_type || filters.token || filters.confidence_min;
      const params: SignalsFilter = { limit: 100 };
      if (filters.chain) params.chain = filters.chain;
      if (filters.signal_type) params.signal_type = filters.signal_type;
      if (filters.token) params.token = filters.token;
      const data = hasFilters ? await getSignals(params) : await getSignalsLatest({ limit: 100 });
      setSignals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Data temporarily unavailable");
    } finally {
      setLoading(false);
    }
  }, [filters.chain, filters.signal_type, filters.token]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(fetchSignals, 30_000);
    return () => clearInterval(interval);
  }, [polling, fetchSignals]);

  useEffect(() => {
    getCurrentUser()
      .then((u) => setFeedTier(signalsFeedTier(u.plan_type)))
      .catch(() => setFeedTier("low"));
  }, []);

  const filtered = applyFilters(signals, filters);

  return (
    <div className="space-y-4">
      {feedTier === "low" ? (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <span className="font-medium text-amber-50">Feed tier: low.</span>{" "}
          Signals are delayed (~15m) and capped.{" "}
          <Link
            href="/pricing"
            className="font-medium underline underline-offset-2 hover:text-white"
          >
            Upgrade to Pro
          </Link>{" "}
          for a medium tier, or Elite for real-time, high-density.
        </div>
      ) : null}
      {feedTier === "medium" ? (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
          <span className="font-medium text-cyan-100">Feed tier: medium (Pro).</span>{" "}
          Near real-time with a short delay and expanded rows.{" "}
          <Link
            href="/pricing"
            className="font-medium underline underline-offset-2 hover:text-white"
          >
            Upgrade to Elite
          </Link>{" "}
          for full real-time, high-density signals.
        </div>
      ) : null}
      <SignalFilters value={filters} onChange={setFilters} disabled={loading} />

      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>
          {filtered.length} signal{filtered.length !== 1 ? "s" : ""}
        </span>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={polling}
            onChange={(e) => setPolling(e.target.checked)}
            className="rounded border-slate-600 bg-slate-900"
          />
          Auto-refresh (30s)
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center text-sm text-slate-400">
          Data temporarily unavailable.{" "}
          <span className="font-mono text-slate-500">{error}</span>
        </div>
      ) : loading && signals.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <div className="h-4 w-24 rounded bg-slate-800" />
              <div className="mt-2 h-4 w-3/4 rounded bg-slate-800" />
              <div className="mt-2 h-3 w-1/2 rounded bg-slate-900" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center text-sm text-slate-400">
          No signals match the current filters. Try adjusting or wait for new data.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              href={
                signal.token_symbol
                  ? `/signals/${encodeURIComponent(signal.token_symbol)}`
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
