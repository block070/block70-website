"use client";

import { clsx } from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NewsIntelligencePayload } from "@/lib/news/build-news-intelligence";
import type { EnrichedNewsArticle, NarrativeClusterId } from "@/lib/news/enrich";

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Los_Angeles", label: "Pacific" },
] as const;

const CLUSTER_LABEL: Record<NarrativeClusterId, string> = {
  etf: "ETF",
  regulation: "Regulation",
  ai: "AI",
  defi: "DeFi",
};

const ALL_CLUSTERS: (NarrativeClusterId | "all")[] = ["all", "etf", "regulation", "ai", "defi"];

const HIGH_IMPACT_MIN = 68;

function formatDate(isoDate: string | null | undefined, tz: string): string {
  if (!isoDate) return "—";
  try {
    return new Date(isoDate).toLocaleString("en-US", {
      timeZone: tz,
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return new Date(isoDate).toLocaleString();
  }
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
        {kicker}
      </p>
      <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[var(--b70-text)]">{title}</h2>
    </div>
  );
}

function SentimentPill({ label, score }: { label: string; score: number }) {
  const tone =
    label === "bullish"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : label === "bearish"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
        : "border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-300";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone,
      )}
    >
      {label}
      <span className="font-[family-name:var(--font-jetbrains)] normal-case opacity-90">
        {score > 0 ? "+" : ""}
        {score}
      </span>
    </span>
  );
}

function SentimentMeter({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, ((score + 100) / 200) * 100));
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[9px] text-[var(--b70-text-muted)]">
        <span>Bearish</span>
        <span>Bullish</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--b70-border)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-500 via-slate-400 to-emerald-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function buildBriefingScript(payload: NewsIntelligencePayload): string {
  const top = payload.whatMatters;
  const titles = top.map((t) => t.article.title).join(". ");
  const kws = payload.trendingKeywords.slice(0, 4).map((k) => k.keyword).join(", ");
  let trend = "";
  if (payload.sentimentTrend && payload.sentimentTrend.recentCount > 0) {
    const { delta, recentAvg, priorAvg } = payload.sentimentTrend;
    trend = ` Average story sentiment moved from ${priorAvg} to ${recentAvg}, change ${delta > 0 ? "plus" : ""}${delta} versus the prior twelve hour window.`;
  }
  const kwPart = kws ? ` Trending phrases include ${kws}.` : "";
  return `Block 70 narrative intelligence briefing. What matters right now: ${titles}.${kwPart}${trend}`;
}

type Props = {
  payload: NewsIntelligencePayload;
  fetchError: string | null;
};

export function NewsIntelligence({ payload, fetchError }: Props) {
  const [tz, setTz] = useState<string>("UTC");
  const [cluster, setCluster] = useState<NarrativeClusterId | "all">("all");
  const [filterBullish, setFilterBullish] = useState(false);
  const [filterBearish, setFilterBearish] = useState(false);
  const [filterHighImpact, setFilterHighImpact] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const speechRef = useRef(false);

  useEffect(() => {
    setSpeechOk(typeof window !== "undefined" && !!window.speechSynthesis);
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const heroIds = useMemo(() => new Set(payload.whatMatters.map((w) => w.article.id)), [payload.whatMatters]);

  const filteredArticles = useMemo(() => {
    return payload.articles.filter((row) => {
      if (cluster !== "all" && !row.clusters.includes(cluster)) return false;

      if (filterBullish || filterBearish) {
        if (filterBullish && filterBearish) {
          if (row.sentimentLabel !== "bullish" && row.sentimentLabel !== "bearish") return false;
        } else if (filterBullish) {
          if (row.sentimentLabel !== "bullish") return false;
        } else if (filterBearish) {
          if (row.sentimentLabel !== "bearish") return false;
        }
      }

      if (filterHighImpact && row.impactScore < HIGH_IMPACT_MIN) return false;
      return true;
    });
  }, [payload.articles, cluster, filterBullish, filterBearish, filterHighImpact]);

  const streamArticles = useMemo(
    () => filteredArticles.filter((row) => !heroIds.has(row.article.id)),
    [filteredArticles, heroIds],
  );

  const toggleAudio = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (playingAudio) {
      window.speechSynthesis.cancel();
      setPlayingAudio(false);
      speechRef.current = false;
      return;
    }
    const text = buildBriefingScript(payload);
    const ut = new SpeechSynthesisUtterance(text);
    ut.rate = 0.95;
    ut.onend = () => {
      speechRef.current = false;
      setPlayingAudio(false);
    };
    ut.onerror = () => {
      speechRef.current = false;
      setPlayingAudio(false);
    };
    speechRef.current = true;
    setPlayingAudio(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(ut);
  }, [payload, playingAudio]);

  return (
    <div className="space-y-8 pb-10 pt-2">
      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
          Narrative intelligence
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          News that moves markets
        </h1>
        <p className="max-w-2xl text-sm text-[var(--b70-text-muted)]">
          Summaries, sentiment, impact, and thematic clusters—deterministic intel from live headlines,
          tuned like a sharper terminal news surface.
        </p>
        {fetchError ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
            Feed warning: {fetchError}. Showing cached or empty results below.
          </div>
        ) : null}
        {!fetchError && payload.articles.length === 0 ? (
          <p className="text-sm text-[var(--b70-text-muted)]">No live news articles yet.</p>
        ) : null}
      </header>

      {speechOk ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggleAudio}
            className={clsx(
              "rounded-lg border px-4 py-2 text-xs font-medium transition-colors",
              playingAudio
                ? "border-[var(--b70-crypto-orange)] bg-[var(--b70-crypto-orange)]/10 text-[var(--b70-crypto-orange)]"
                : "border-[var(--b70-border)] bg-[var(--b70-card)] text-[var(--b70-text)] hover:border-[var(--b70-crypto-blue)]/50",
            )}
          >
            {playingAudio ? "Stop briefing" : "Play briefing (~1 min)"}
          </button>
          <span className="text-[11px] text-[var(--b70-text-muted)]">
            Uses your browser voice; best with headphones.
          </span>
        </div>
      ) : null}

      {/* What matters */}
      <section>
        <SectionTitle kicker="Pulse" title="What matters" />
        {payload.whatMatters.length === 0 ? (
          <p className="text-sm text-[var(--b70-text-muted)]">No highlighted stories yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {payload.whatMatters.map((row) => (
              <StoryCard key={row.article.id} row={row} tz={tz} hero />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          {/* Cluster + filters */}
          <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
            <p className="text-[11px] font-semibold text-[var(--b70-text-muted)]">Narrative clusters</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_CLUSTERS.map((id) => {
                const active = cluster === id;
                const label = id === "all" ? "All" : CLUSTER_LABEL[id];
                const count =
                  id === "all"
                    ? payload.articles.length
                    : payload.clusterCounts[id as NarrativeClusterId];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCluster(id)}
                    className={clsx(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-[var(--b70-crypto-blue)] bg-[var(--b70-crypto-blue)]/10 text-[var(--b70-text)]"
                        : "border-[var(--b70-border)] text-[var(--b70-text-muted)] hover:text-[var(--b70-text)]",
                    )}
                  >
                    {label}
                    <span className="ml-1 font-[family-name:var(--font-jetbrains)] text-[10px] opacity-70">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] font-semibold text-[var(--b70-text-muted)]">
              Filters{" "}
              <span className="font-normal normal-case opacity-80">
                — sentiment tags are OR; high impact must also match.
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilterBullish(!filterBullish)}
                className={clsx(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  filterBullish
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-[var(--b70-border)] text-[var(--b70-text-muted)] hover:text-[var(--b70-text)]",
                )}
              >
                Bullish
              </button>
              <button
                type="button"
                onClick={() => setFilterBearish(!filterBearish)}
                className={clsx(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  filterBearish
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                    : "border-[var(--b70-border)] text-[var(--b70-text-muted)] hover:text-[var(--b70-text)]",
                )}
              >
                Bearish
              </button>
              <button
                type="button"
                onClick={() => setFilterHighImpact(!filterHighImpact)}
                className={clsx(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  filterHighImpact
                    ? "border-[var(--b70-crypto-orange)]/50 bg-[var(--b70-crypto-orange)]/10 text-[var(--b70-crypto-orange)]"
                    : "border-[var(--b70-border)] text-[var(--b70-text-muted)] hover:text-[var(--b70-text)]",
                )}
              >
                High impact
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="news-intel-tz" className="text-xs text-[var(--b70-text-muted)]">
              Timezone
            </label>
            <select
              id="news-intel-tz"
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-1.5 text-sm text-[var(--b70-text)] focus:border-[var(--b70-crypto-blue)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--b70-crypto-blue)]/50"
            >
              {TIMEZONES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <SectionTitle kicker="Wire" title="Story stream" />
          {streamArticles.length === 0 ? (
            <p className="text-sm text-[var(--b70-text-muted)]">
              {filteredArticles.length === 0
                ? "No articles match the current filters."
                : "All matching stories are in What matters above."}
            </p>
          ) : (
            <div className="space-y-3">
              {streamArticles.map((row, idx) => (
                <StoryCard key={row.article.id ?? row.article.url ?? idx} row={row} tz={tz} />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
            <SectionTitle kicker="Topics" title="Trending keywords" />
            {payload.trendingKeywords.length === 0 ? (
              <p className="text-xs text-[var(--b70-text-muted)]">Not enough headlines to rank terms.</p>
            ) : (
              <ul className="space-y-2">
                {payload.trendingKeywords.map((k) => (
                  <li
                    key={k.keyword}
                    className="flex items-center justify-between gap-2 text-xs text-[var(--b70-text)]"
                  >
                    <span className="font-medium capitalize">{k.keyword}</span>
                    <span className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-crypto-orange)]">
                      {k.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
            <SectionTitle kicker="Tone" title="Sentiment trend" />
            {payload.sentimentTrend == null ? (
              <p className="text-xs text-[var(--b70-text-muted)]">
                Timestamps missing or not enough stories in the 24h window.
              </p>
            ) : (
              <div className="space-y-2 text-xs text-[var(--b70-text)]">
                <p className="text-[var(--b70-text-muted)]">
                  Last 12h avg <span className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-text)]">{payload.sentimentTrend.recentAvg}</span>
                  {" · "}
                  prior 12h{" "}
                  <span className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-text)]">
                    {payload.sentimentTrend.priorAvg}
                  </span>
                </p>
                <p>
                  Delta{" "}
                  <span
                    className={clsx(
                      "font-[family-name:var(--font-jetbrains)] font-semibold",
                      payload.sentimentTrend.delta > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : payload.sentimentTrend.delta < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-[var(--b70-text-muted)]",
                    )}
                  >
                    {payload.sentimentTrend.delta > 0 ? "+" : ""}
                    {payload.sentimentTrend.delta}
                  </span>
                  <span className="text-[var(--b70-text-muted)]">
                    {" "}
                    ({payload.sentimentTrend.recentCount} recent / {payload.sentimentTrend.priorCount} prior stories)
                  </span>
                </p>
              </div>
            )}
          </div>

          <p className="text-[10px] leading-relaxed text-[var(--b70-text-muted)]">
            As of {new Date(payload.generatedAt).toLocaleString()} · Scores are heuristic, not investment advice.
          </p>
        </aside>
      </div>
    </div>
  );
}

function StoryCard({
  row,
  tz,
  hero = false,
}: {
  row: EnrichedNewsArticle;
  tz: string;
  hero?: boolean;
}) {
  const { article, bullets, sentimentLabel, sentimentScore, impactScore, clusters } = row;
  return (
    <article
      className={clsx(
        "rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm transition-colors hover:border-[var(--b70-crypto-blue)]/35",
        hero && "md:min-h-[220px]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-[var(--b70-border)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--b70-text-muted)]">
            {article.source}
          </span>
          <SentimentPill label={sentimentLabel} score={sentimentScore} />
          <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-[var(--b70-crypto-orange)]">
            Impact {impactScore}
          </span>
        </div>
        <span className="text-[10px] text-[var(--b70-text-muted)]">{formatDate(article.published_at, tz)}</span>
      </div>

      {clusters.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {clusters.map((c) => (
            <span
              key={c}
              className="rounded bg-[var(--b70-bg)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--b70-text-muted)]"
            >
              {CLUSTER_LABEL[c]}
            </span>
          ))}
        </div>
      ) : null}

      <h3 className={clsx("mt-2 font-semibold text-[var(--b70-text)]", hero ? "text-base" : "text-sm")}>
        <a href={article.url} target="_blank" rel="noreferrer" className="hover:underline">
          {article.title}
        </a>
      </h3>

      {!hero ? <SentimentMeter score={sentimentScore} /> : null}

      <ul className={clsx("mt-3 list-disc space-y-1.5 pl-4 text-[var(--b70-text-muted)]", hero ? "text-sm" : "text-xs")}>
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>

      <a
        href={article.url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-block text-[11px] font-medium text-[var(--b70-crypto-blue)] hover:underline"
      >
        Open source →
      </a>
    </article>
  );
}
