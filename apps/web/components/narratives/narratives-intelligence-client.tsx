"use client";

import Link from "next/link";
import { useEffect } from "react";
import useSWR from "swr";
import { clsx } from "clsx";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { NarrativeIntelligenceListResponse, NarrativeIntelligenceRow } from "@/lib/types";

const INTEL_KEY = "/api/v1/narratives/intelligence?limit=50";

async function swrFetcher(url: string): Promise<NarrativeIntelligenceListResponse> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

function narrativeHref(name: string): string {
  return `/narratives/${encodeURIComponent(name)}`;
}

function sentimentStyles(s: number): { label: string; className: string } {
  if (s >= 0.2)
    return {
      label: "Bullish skew",
      className: "border-emerald-500/40 text-emerald-300",
    };
  if (s <= -0.2)
    return {
      label: "Risk-heavy",
      className: "border-rose-500/40 text-rose-300",
    };
  return {
    label: "Neutral",
    className: "border-[var(--b70-border)] text-[var(--b70-text-muted)]",
  };
}

function bubbleFill(sentiment: number): string {
  if (sentiment >= 0.2) return "#34d399";
  if (sentiment <= -0.2) return "#fb7185";
  return "var(--b70-crypto-blue)";
}

function formatGrowthRate(g: number | null | undefined): string {
  if (g == null) return "New";
  const pct = g * 100;
  const capped = Math.max(-999, Math.min(999, pct));
  return `${capped >= 0 ? "+" : ""}${capped.toFixed(0)}%`;
}

type NarrativeBubbleDatum = {
  id: number;
  name: string;
  growth_rate: number;
  is_new_growth: boolean;
  sentiment: number;
  attention: number;
};

function NarrativeScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: NarrativeBubbleDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const growthLabel = p.is_new_growth ? "New" : formatGrowthRate(p.growth_rate);
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{
        background: "var(--b70-card)",
        borderColor: "var(--b70-border)",
        color: "var(--b70-text)",
      }}
    >
      <p className="font-semibold" style={{ color: "var(--b70-text)" }}>
        {p.name}
      </p>
      <p className="mt-1" style={{ color: "var(--b70-text-muted)" }}>
        7d vs prior 7d:{" "}
        <span className="font-[family-name:var(--font-jetbrains)] font-medium" style={{ color: "var(--b70-text)" }}>
          {growthLabel}
        </span>
      </p>
      <p className="mt-0.5" style={{ color: "var(--b70-text-muted)" }}>
        Sentiment:{" "}
        <span className="font-[family-name:var(--font-jetbrains)] font-medium" style={{ color: "var(--b70-text)" }}>
          {p.sentiment.toFixed(2)}
        </span>
      </p>
      <p className="mt-0.5" style={{ color: "var(--b70-text-muted)" }}>
        Attention (plot size):{" "}
        <span className="font-[family-name:var(--font-jetbrains)] font-medium" style={{ color: "var(--b70-text)" }}>
          {p.attention.toFixed(2)}
        </span>
      </p>
    </div>
  );
}

const LINE_PALETTE = ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#f472b6"];

type Props = {
  initialData: NarrativeIntelligenceListResponse | null;
};

export function NarrativesIntelligenceClient({ initialData }: Props) {
  const { data, error } = useSWR<NarrativeIntelligenceListResponse>(INTEL_KEY, swrFetcher, {
    refreshInterval: 60_000,
    fallbackData: initialData ?? undefined,
    revalidateOnFocus: true,
  });

  const payload = data;
  const narratives = payload?.narratives ?? [];
  const computedAt = payload?.computed_at;

  const sortedByAttention = [...narratives].sort((a, b) => b.attention - a.attention);
  const top5Trend = sortedByAttention.slice(0, 5);
  const withSignal = narratives.filter(
    (n) =>
      n.attention > 1e-9 ||
      n.growth_rate === null ||
      (n.growth_rate != null && Math.abs(n.growth_rate) > 1e-9),
  );
  const rising = [...withSignal]
    .filter((n) => n.attention >= 0.02 || (n.growth_rate ?? 0) > 0 || n.growth_rate === null)
    .sort((a, b) => {
      const ga = a.growth_rate === null ? Number.POSITIVE_INFINITY : a.growth_rate;
      const gb = b.growth_rate === null ? Number.POSITIVE_INFINITY : b.growth_rate;
      return gb - ga;
    })
    .slice(0, 8);
  const fading = [...withSignal]
    .filter((n) => n.attention >= 0.02 || (n.growth_rate ?? 0) < 0)
    .sort((a, b) => (a.growth_rate ?? 0) - (b.growth_rate ?? 0))
    .slice(0, 8);

  const dates =
    top5Trend[0]?.daily_series.map((d) => d.date) ??
    narratives[0]?.daily_series.map((d) => d.date) ??
    [];

  const trendRows = dates.map((date) => {
    const row: Record<string, string | number> = { date: date.slice(5) };
    top5Trend.forEach((n, i) => {
      const pt = n.daily_series.find((p) => p.date === date);
      row[`s${i}`] = pt?.attention ?? 0;
    });
    return row;
  });

  const trendHasData = trendRows.some((r) =>
    top5Trend.some((_, i) => Number(r[`s${i}`]) > 1e-9),
  );

  const bubbleData: NarrativeBubbleDatum[] = sortedByAttention
    .filter((n) => n.trend_score > 0 || n.attention > 0)
    .slice(0, 40)
    .map((n) => ({
      id: n.id,
      name: n.name,
      growth_rate: n.growth_rate ?? 0,
      is_new_growth: n.growth_rate === null,
      sentiment: n.sentiment,
      attention: Math.max(n.attention, 0.01),
    }));

  // #region agent log
  useEffect(() => {
    const list = data?.narratives ?? initialData?.narratives ?? [];
    if (list.length === 0) return;
    const sample = list.slice(0, 6).map((n) => ({
      id: n.id,
      growth_rate: n.growth_rate,
    }));
    fetch("http://127.0.0.1:7428/ingest/b2bee36a-3f9b-42a9-b6fb-0dc54bacc543", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "9aa1f6",
      },
      body: JSON.stringify({
        sessionId: "9aa1f6",
        location: "narratives-intelligence-client.tsx:intelSample",
        message: "narrative growth sample after load",
        data: { sample, n: list.length },
        timestamp: Date.now(),
        hypothesisId: "H-verify-growth",
        runId: "post-fix",
      }),
    }).catch(() => {});
  }, [data?.narratives, initialData?.narratives]);
  // #endregion

  return (
    <div className="space-y-10 pb-16 pt-2">
      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
          Market psychology
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          Narrative intelligence
        </h1>
        <p className="max-w-2xl text-sm text-[var(--b70-text-muted)]">
          Which stories are pulling attention in narrative-type opportunities: sentiment proxies, attention
          velocity, rotation, and linked symbols—refreshed on a short interval.
        </p>
        <p className="text-[11px] text-[var(--b70-text-muted)]">
          As of{" "}
          {computedAt
            ? new Date(computedAt).toLocaleString(undefined, { timeZone: "UTC" }) + " UTC"
            : "—"}
          {error ? " · live refresh failed (showing last good data)" : ""}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
          <SectionLabel kicker="Rotation" title="Narratives gaining attention" />
          {rising.length === 0 ? (
            <p className="text-xs text-[var(--b70-text-muted)]">No rotation signal yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rising.map((n) => (
                <RotationRow key={n.id} n={n} positive />
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
          <SectionLabel kicker="Rotation" title="Narratives losing steam" />
          {fading.length === 0 ? (
            <p className="text-xs text-[var(--b70-text-muted)]">No rotation signal yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {fading.map((n) => (
                <RotationRow key={n.id} n={n} positive={false} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
        <SectionLabel
          kicker="Attention"
          title="Narrative popularity (14d, top 5 by 7d attention)"
        />
        {!trendHasData ? (
          <p className="text-xs text-[var(--b70-text-muted)]">
            Insufficient history for multi-narrative lines—matching opportunities need dated activity.
          </p>
        ) : (
          <div className="h-[280px] min-h-[200px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <LineChart data={trendRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--b70-border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--b70-text-muted)", fontSize: 10 }} />
                <YAxis tick={{ fill: "var(--b70-text-muted)", fontSize: 10 }} width={36} />
                <Tooltip
                  contentStyle={{
                    background: "var(--b70-card)",
                    border: "1px solid var(--b70-border)",
                    borderRadius: "8px",
                    color: "var(--b70-text)",
                  }}
                  labelStyle={{ color: "var(--b70-text)" }}
                  itemStyle={{ color: "var(--b70-text-muted)" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(_, entry) => {
                    const i = Number(String(entry.dataKey).replace("s", ""));
                    const name = top5Trend[i]?.name ?? String(entry.dataKey);
                    return name.length > 22 ? `${name.slice(0, 20)}…` : name;
                  }}
                />
                {top5Trend.map((_, i) => (
                  <Line
                    key={i}
                    type="monotone"
                    dataKey={`s${i}`}
                    stroke={LINE_PALETTE[i % LINE_PALETTE.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
        <SectionLabel kicker="Map" title="Attention × sentiment bubble chart" />
        {bubbleData.length === 0 ? (
          <p className="text-xs text-[var(--b70-text-muted)]">No points to plot.</p>
        ) : (
          <div className="h-[360px] min-h-[240px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minHeight={240}>
              <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--b70-border)" />
                <XAxis
                  type="number"
                  dataKey="growth_rate"
                  name="Growth"
                  tick={{ fill: "var(--b70-text-muted)", fontSize: 10 }}
                  tickFormatter={(v) => formatGrowthRate(Number(v))}
                  label={{ value: "7d attention growth", position: "bottom", offset: 0, fill: "var(--b70-text-muted)", fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="sentiment"
                  domain={[-1, 1]}
                  name="Sentiment"
                  tick={{ fill: "var(--b70-text-muted)", fontSize: 10 }}
                  label={{ value: "Sentiment proxy", angle: -90, position: "insideLeft", fill: "var(--b70-text-muted)", fontSize: 10 }}
                />
                <ZAxis type="number" dataKey="attention" range={[80, 420]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={(tipProps) => <NarrativeScatterTooltip {...tipProps} />}
                />
                <Scatter name="Narratives" data={bubbleData}>
                  {bubbleData.map((d) => (
                    <Cell key={d.id} fill={bubbleFill(d.sentiment)} fillOpacity={0.75} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-[10px] text-[var(--b70-text-muted)]">
          Size scales with 7d attention sum; color encodes opportunity-basis sentiment proxy.
        </p>
      </section>

      <section>
        <SectionLabel kicker="Stories" title="Narrative cards" />
        {narratives.length === 0 ? (
          <p className="text-sm text-[var(--b70-text-muted)]">
            No market narratives returned. Seed `market_narratives` and narrative-type opportunities, or check
            API connectivity.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {narratives.map((n) => (
              <NarrativeCard key={n.id} n={n} />
            ))}
          </div>
        )}
      </section>

      <p className="text-[10px] leading-relaxed text-[var(--b70-text-muted)]">
        How we link data: each narrative name must appear (case-insensitive) in a narrative-type
        opportunity&apos;s title or summary. Sentiment is mean(upside_score − risk_score); growth compares
        trailing 7d attention to the prior 7d. Not investment advice.
      </p>
    </div>
  );
}

function SectionLabel({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
        {kicker}
      </p>
      <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[var(--b70-text)]">{title}</h2>
    </div>
  );
}

function RotationRow({ n, positive }: { n: NarrativeIntelligenceRow; positive: boolean }) {
  const g = formatGrowthRate(n.growth_rate);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--b70-border)]/60 py-2 last:border-0">
      <Link
        href={narrativeHref(n.name)}
        className="font-medium text-[var(--b70-text)] hover:underline"
      >
        {n.name}
      </Link>
      <span
        className={clsx(
          "font-[family-name:var(--font-jetbrains)] text-xs",
          n.growth_rate === null
            ? "text-sky-400/95"
            : positive && n.growth_rate > 0.02
              ? "text-emerald-400"
              : !positive && n.growth_rate < -0.02
                ? "text-rose-400"
                : "text-[var(--b70-text-muted)]",
        )}
      >
        {g}
      </span>
    </li>
  );
}

function NarrativeCard({ n }: { n: NarrativeIntelligenceRow }) {
  const sent = sentimentStyles(n.sentiment);
  return (
    <article className="flex flex-col rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm transition hover:border-[var(--b70-crypto-blue)]/40">
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link href={narrativeHref(n.name)} className="text-sm font-semibold text-[var(--b70-text)] hover:underline">
          {n.name}
        </Link>
        <span
          className={clsx(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
            sent.className,
          )}
        >
          {sent.label}
        </span>
      </div>
      <p className="mb-3 line-clamp-3 text-xs text-[var(--b70-text-muted)]">{n.description ?? "—"}</p>
      <div className="mt-auto flex flex-wrap gap-3 text-[11px]">
        <div>
          <p className="text-[var(--b70-text-muted)]">7d attention</p>
          <p className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-text)]">
            {n.attention.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-[var(--b70-text-muted)]">Growth</p>
          <p
            className={clsx(
              "font-[family-name:var(--font-jetbrains)]",
              n.growth_rate === null
                ? "text-sky-400/95"
                : n.growth_rate >= 0
                  ? "text-emerald-400"
                  : "text-rose-400",
            )}
          >
            {formatGrowthRate(n.growth_rate)}
          </p>
        </div>
        <div>
          <p className="text-[var(--b70-text-muted)]">Trend score</p>
          <p className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-text)]">
            {(n.trend_score * 100).toFixed(0)}%
          </p>
        </div>
      </div>
      {n.related_symbols.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--b70-border)]/60 pt-3">
          <span className="w-full text-[10px] uppercase tracking-wide text-[var(--b70-text-muted)]">
            Related
          </span>
          {n.related_symbols.map((sym) => (
            <Link
              key={sym}
              href={`/coins/${encodeURIComponent(sym)}`}
              className="rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--b70-crypto-blue)] hover:border-[var(--b70-crypto-blue)]/50"
            >
              {sym}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}
