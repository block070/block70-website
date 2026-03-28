"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Filter,
  Newspaper,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { clsx } from "clsx";
import type { AlphaPostDto } from "@/lib/community-api";
import type { AlphaEvent, AlphaRankedOpportunity } from "@/lib/types";
import { getPremiumAlerts } from "@/lib/api";
import {
  DESK_PICKS_COUNT,
  PREMIUM_POST_CONFIDENCE_THRESHOLD,
  confidencePercent,
  presentCommunityAlphaCategory,
} from "@/lib/alpha-desk-present";
import { AlphaPostDeskCard } from "./alpha-post-desk-card";
import { AlphaEngineBriefCard } from "./alpha-engine-brief-card";

type BriefingLite = {
  id: number;
  summary: string;
  created_at: string;
} | null;

type PlanType = "free" | "pro" | "elite";

const PLAN_RANK: Record<PlanType, number> = {
  free: 0,
  pro: 1,
  elite: 2,
};

const COMMUNITY_TYPES: { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "research", label: presentCommunityAlphaCategory("research").label },
  { value: "signal", label: presentCommunityAlphaCategory("signal").label },
  { value: "strategy", label: presentCommunityAlphaCategory("strategy").label },
  { value: "trade_idea", label: presentCommunityAlphaCategory("trade_idea").label },
];

type Props = {
  initialPosts: AlphaPostDto[];
  initialAlphaTop: AlphaRankedOpportunity[];
  initialAlphaFeed: AlphaEvent[];
  briefing: BriefingLite;
  loadWarnings: string[];
};

export function AlphaDeskClient({
  initialPosts,
  initialAlphaTop,
  initialAlphaFeed,
  briefing,
  loadWarnings,
}: Props) {
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [minConfidence, setMinConfidence] = useState(0);
  const [planType, setPlanType] = useState<PlanType>("free");

  useEffect(() => {
    const userIdentifier =
      process.env.NEXT_PUBLIC_USER_IDENTIFIER ?? "demo-user";
    let cancelled = false;
    async function loadPlan() {
      try {
        const subs = await getPremiumAlerts();
        const relevant = subs.filter(
          (s) => s.user_identifier === userIdentifier,
        );
        let best: PlanType = "free";
        for (const sub of relevant) {
          const plan = (sub.plan_type ?? "free") as PlanType;
          if (PLAN_RANK[plan] > PLAN_RANK[best]) best = plan;
        }
        if (!cancelled) setPlanType(best);
      } catch {
        if (!cancelled) setPlanType("free");
      }
    }
    void loadPlan();
    return () => {
      cancelled = true;
    };
  }, []);

  const isPaid = planType !== "free";

  const sortedTop = useMemo(() => {
    return [...initialAlphaTop].sort(
      (a, b) => (b.alpha_score ?? 0) - (a.alpha_score ?? 0),
    );
  }, [initialAlphaTop]);

  const deskPicks = useMemo(
    () => sortedTop.slice(0, DESK_PICKS_COUNT),
    [sortedTop],
  );

  const restRanked = useMemo(
    () => sortedTop.slice(DESK_PICKS_COUNT),
    [sortedTop],
  );

  const filteredPosts = useMemo(() => {
    return initialPosts.filter((p) => {
      if (typeFilter && p.alpha_type !== typeFilter) return false;
      if (confidencePercent(p.confidence_score) < minConfidence) return false;
      return true;
    });
  }, [initialPosts, typeFilter, minConfidence]);

  const feedSlice = useMemo(
    () => initialAlphaFeed.slice(0, 18),
    [initialAlphaFeed],
  );

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5 md:p-6">
        <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-[var(--b70-crypto-blue)]/10 blur-3xl" />
        <div className="relative space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--b70-crypto-blue)]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--b70-crypto-blue)]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Block70 research desk
            </span>
            {!isPaid ? (
              <span className="text-[10px] text-[var(--b70-text-muted)]">
                Desk picks blurred on Free —{" "}
                <Link href="/pricing" className="text-[var(--b70-crypto-blue)] underline">
                  upgrade
                </Link>
              </span>
            ) : null}
          </div>
          <h1 className="font-[family-name:var(--font-jetbrains)] text-2xl font-bold tracking-tight text-[var(--b70-text)] md:text-3xl">
            Premium alpha &amp; signals
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[var(--b70-text-muted)]">
            Community-led theses plus model-ranked opportunities—not financial advice. Verify every
            thread and data point before acting.
          </p>
        </div>
      </section>

      {loadWarnings.length > 0 ? (
        <div
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-100"
        >
          {loadWarnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      ) : null}

      {briefing ? (
        <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
          <div className="flex items-center gap-2 text-[var(--b70-crypto-blue)]">
            <Newspaper className="h-4 w-4" aria-hidden />
            <h2 className="text-sm font-semibold text-[var(--b70-text)]">Latest briefing</h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--b70-text-muted)]">
            {briefing.summary}
          </p>
          <p className="mt-2 text-[10px] text-[var(--b70-text-muted)]">
            {new Date(briefing.created_at).toLocaleString()}
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[var(--b70-crypto-blue)]" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--b70-text)]">Desk picks</h2>
        </div>
        <p className="text-[11px] text-[var(--b70-text-muted)]">
          Top {DESK_PICKS_COUNT} ranked opportunities by model desk score. Not an investment grade.
        </p>
        {deskPicks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--b70-border)] bg-[var(--b70-bg)] px-4 py-6 text-center text-sm text-[var(--b70-text-muted)]">
            No ranked desk picks yet. Check back after the next alpha snapshot run.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {deskPicks.map((entry) => (
              <AlphaEngineBriefCard
                key={`pick-${entry.opportunity.id}`}
                variant="ranked"
                entry={entry}
                premiumLocked={!isPaid}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-[var(--b70-crypto-blue)]" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--b70-text)]">Community insights</h2>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {COMMUNITY_TYPES.map((t) => {
            const active = typeFilter === t.value;
            return (
              <button
                key={t.value || "all"}
                type="button"
                onClick={() => setTypeFilter(t.value)}
                className={clsx(
                  "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "border-[var(--b70-crypto-blue)] bg-[var(--b70-crypto-blue)]/15 text-[var(--b70-crypto-blue)]"
                    : "border-[var(--b70-border)] bg-[var(--b70-bg)] text-[var(--b70-text-muted)] hover:border-[var(--b70-crypto-blue)]/40",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-[var(--b70-text-muted)]">Min confidence</label>
          <select
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="h-8 rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 text-xs text-[var(--b70-text)]"
          >
            <option value={0}>Any</option>
            <option value={50}>50%+</option>
            <option value={70}>70%+</option>
            <option value={85}>85%+</option>
          </select>
          <Link
            href="/community"
            className="ml-auto text-[11px] font-semibold text-[var(--b70-crypto-blue)] hover:underline"
          >
            Community hub →
          </Link>
        </div>
        {filteredPosts.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--b70-text-muted)]">
            No posts match filters. Try lowering confidence or clearing type.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {filteredPosts.map((post) => (
              <AlphaPostDeskCard
                key={post.id}
                post={post}
                premiumLocked={
                  !isPaid && post.confidence_score >= PREMIUM_POST_CONFIDENCE_THRESHOLD
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[var(--b70-crypto-blue)]" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--b70-text)]">More engine briefs</h2>
        </div>
        <p className="text-[11px] text-[var(--b70-text-muted)]">
          Additional ranked opportunities below desk picks, then a condensed alpha event stream.
        </p>
        {restRanked.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {restRanked.map((entry) => (
              <AlphaEngineBriefCard
                key={`ranked-${entry.opportunity.id}`}
                variant="ranked"
                entry={entry}
                premiumLocked={false}
              />
            ))}
          </div>
        ) : null}
        {feedSlice.length > 0 ? (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
              Live alpha feed
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {feedSlice.map((ev) => (
                <AlphaEngineBriefCard key={`feed-${ev.id}`} variant="event" entry={ev} />
              ))}
            </div>
          </>
        ) : null}
        {restRanked.length === 0 && feedSlice.length === 0 ? (
          <p className="text-sm text-[var(--b70-text-muted)]">
            No additional engine rows yet.
          </p>
        ) : null}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-bg)] px-4 py-3">
        <div className="flex items-center gap-2 text-[var(--b70-text)]">
          <BookOpen className="h-4 w-4 text-[var(--b70-crypto-blue)]" aria-hidden />
          <span className="text-xs">
            History &amp; snapshots:{" "}
            <Link href="/alpha-history" className="font-semibold text-[var(--b70-crypto-blue)] underline">
              Alpha history
            </Link>
          </span>
        </div>
        <Link
          href="/opportunities"
          className="text-xs font-semibold text-[var(--b70-crypto-blue)] hover:underline"
        >
          Opportunity engine →
        </Link>
      </section>
    </div>
  );
}
