"use client";

import { useEffect, useState } from "react";

import type { NarrativeTokenGroup, Opportunity } from "@/lib/types";
import { getNarrativeTokens, getTrendingNarratives } from "@/lib/api";

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${value.toFixed(digits)}%`;
}

function formatScore(score: number | null | undefined, digits = 0): string {
  if (score == null || Number.isNaN(score)) return "–";
  return `${(score * 100).toFixed(digits)}%`;
}

export function NarrativePanel() {
  const [trending, setTrending] = useState<Opportunity[]>([]);
  const [byToken, setByToken] = useState<NarrativeTokenGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [trendingResp, tokensResp] = await Promise.all([
          getTrendingNarratives(),
          getNarrativeTokens(),
        ]);
        if (cancelled) return;
        setTrending(trendingResp ?? []);
        setByToken(tokensResp ?? []);
      } catch {
        if (!cancelled) {
          setError(
            "Unable to load narrative intelligence from the backend right now.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
        Mapping narratives across tokens…
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-xs text-rose-100">
        {error}
      </section>
    );
  }

  if ((!trending || trending.length === 0) && (!byToken || byToken.length === 0)) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
        No strong narratives detected yet. As AI, restaking, and other themes
        pick up across multiple tokens, they&apos;ll light up here.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold text-slate-50">Narrative Heat</h3>
      <p className="mt-1 text-[11px] text-slate-400">
        See which narratives are actually gaining traction across tokens based
        on social, dev, wallet, and price action.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Trending Narratives */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Trending Narratives
          </h4>
          {renderTrendingNarratives(trending)}
        </div>

        {/* Top Tokens in Narrative */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Top Tokens in Narrative
          </h4>
          {renderNarrativeTokens(byToken)}
        </div>
      </div>
    </section>
  );
}

function renderTrendingNarratives(opps: Opportunity[]) {
  if (!opps || opps.length === 0) {
    return (
      <p className="text-[11px] text-slate-500">
        No narrative leaders yet. As themes like AI infra or BTC L2 show
        consistent strength, they&apos;ll surface here.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {opps.slice(0, 6).map((opp) => (
        <li
          key={opp.id}
          className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
        >
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold text-slate-100 line-clamp-1">
              {opp.title}
            </p>
            <p className="text-[11px] text-slate-500 line-clamp-2">
              {opp.summary ??
                "Composite signal from social, dev, wallet, and price momentum."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              {formatScore(opp.total_score, 0)}
            </span>
            <span className="text-[10px] text-slate-500">
              Confidence{" "}
              <span className="font-semibold text-emerald-300">
                {formatScore(opp.confidence_score, 0)}
              </span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function renderNarrativeTokens(groups: NarrativeTokenGroup[]) {
  if (!groups || groups.length === 0) {
    return (
      <p className="text-[11px] text-slate-500">
        No clustered tokens yet. As more assets share the same narrative, they
        will appear here.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {groups.slice(0, 6).map((group) => {
        const top = group.opportunities[0];
        const strength =
          top?.estimated_upside != null && !Number.isNaN(top.estimated_upside)
            ? Math.max(0, Math.min(top.estimated_upside / 200, 1))
            : top?.total_score ?? 0;

        return (
          <li
            key={group.token_symbol}
            className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-100">
                {group.token_symbol}
              </span>
              <span className="text-[10px] text-slate-500">
                {group.opportunities.length} narrative signal
                {group.opportunities.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-emerald-400"
                style={{ width: `${Math.max(10, Math.min(strength * 100, 100))}%` }}
              />
            </div>
            {top ? (
              <p className="text-[11px] text-slate-500 line-clamp-2">
                {top.summary ??
                  "Narrative strength score derived from multi-signal agreement."}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

