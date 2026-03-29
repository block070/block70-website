"use client";

import useSWR from "swr";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";

import type { CapitalFlowSummaryDto } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";
import { CapitalFlowChart } from "@/components/flows/capital-flow-chart";
import { CapitalFlowSankey } from "./capital-flow-sankey";

async function fetchSummary(hours: number, chain: string | undefined): Promise<CapitalFlowSummaryDto> {
  const p = new URLSearchParams({ hours: String(hours) });
  if (chain) p.set("chain", chain);
  const r = await fetch(`/api/flows/summary?${p}`, { cache: "no-store" });
  if (!r.ok) {
    let detail = "";
    try {
      const j = (await r.json()) as { message?: string };
      detail = j?.message ? String(j.message) : "";
    } catch {
      detail = await r.text();
    }
    throw new Error(detail || `HTTP ${r.status}`);
  }
  return r.json() as Promise<CapitalFlowSummaryDto>;
}

const HOURS_OPTIONS = [
  { value: 24, label: "24h" },
  { value: 168, label: "7d" },
  { value: 720, label: "30d" },
] as const;

const CHAIN_OPTIONS = [
  { value: "", label: "All chains" },
  { value: "solana", label: "Solana" },
  { value: "ethereum", label: "Ethereum" },
  { value: "bitcoin", label: "Bitcoin" },
] as const;

function formatVol(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(0);
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

type Props = {
  initialSummary: CapitalFlowSummaryDto | null;
  defaultHours?: number;
};

export function CapitalFlowDashboardClient({
  initialSummary,
  defaultHours = 24,
}: Props) {
  const [hours, setHours] = useState<number>(defaultHours);
  const [chain, setChain] = useState<string>("");

  const swrKey = ["/api/flows/summary", hours, chain || "all"] as const;

  const { data, error, isLoading, isValidating } = useSWR(
    swrKey,
    () => fetchSummary(hours, chain || undefined),
    {
      refreshInterval: 45_000,
      revalidateOnFocus: true,
      fallbackData: initialSummary ?? undefined,
    },
  );

  const summary = data;

  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  useEffect(() => {
    if (data) setLastUpdatedAt(Date.now());
  }, [data]);

  const [catQ, setCatQ] = useState("");

  const filteredCategories = useMemo(() => {
    const rows = summary?.by_category ?? [];
    const q = catQ.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.category.toLowerCase().includes(q));
  }, [summary?.by_category, catQ]);

  const dominant = summary?.dominant_chain;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1">
          {HOURS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setHours(o.value)}
              className={clsx(
                "rounded-md px-2.5 py-1 text-[11px] font-medium",
                hours === o.value
                  ? "bg-[var(--b70-crypto-blue)] text-white"
                  : "border border-[var(--b70-border)] text-[var(--b70-text-muted)] hover:border-[var(--b70-crypto-blue)]/40",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[10px] font-medium uppercase tracking-wide text-[var(--b70-text-muted)]">
            Chain
          </label>
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            className="h-8 rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 text-xs text-[var(--b70-text)] outline-none focus:border-[var(--b70-crypto-blue)]/50"
          >
            {CHAIN_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-[var(--b70-text-muted)]">
            Auto-refresh ~45s
            {lastUpdatedAt ? ` · Updated ${formatTime(lastUpdatedAt)}` : null}
            {isValidating ? " · Syncing…" : ""}
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
          Live refresh failed ({String((error as Error).message)}). Showing last good snapshot if
          available.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Window volume"
          value={summary ? formatVol(summary.total_volume) : isLoading ? "…" : "—"}
          hint="Sum of flow amounts in window"
        />
        <KpiCard
          label="Dominant chain"
          value={dominant?.chain ? dominant.chain : "—"}
          hint={dominant ? `${formatVol(dominant.total_amount)} · ${dominant.flow_count} legs` : ""}
        />
        <KpiCard
          label="Hot edges"
          value={summary ? String(summary.hot_edges.length) : "—"}
          hint="Top aggregated routes"
        />
        <KpiCard
          label="Categories (sample)"
          value={summary ? String(summary.by_category.length) : "—"}
          hint="From top destinations vs coins DB"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sankey — capital rails" subtitle="Width ~ relative flow (aggregated)" />
          <div className="p-4">
            <CapitalFlowSankey edges={summary?.hot_edges ?? []} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Flow network (SVG)" subtitle="Compact rail view" />
          <div className="p-4">
            <CapitalFlowChart
              flows={summary?.hot_edges ?? []}
              maxNodes={14}
              className="text-[var(--b70-crypto-blue)]"
            />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Hot flows" subtitle="Largest aggregated movements" />
          <div className="p-4">
            {!summary?.hot_edges.length ? (
              <EmptyHint />
            ) : (
              <ul className="space-y-2">
                {summary.hot_edges.slice(0, 12).map((t, i) => (
                  <li
                    key={`${t.source_asset}-${t.destination_asset}-${t.chain}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/50 px-3 py-2 text-xs"
                  >
                    <span className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-text)]">
                      {t.source_asset} → {t.destination_asset}{" "}
                      <span className="text-[var(--b70-text-muted)]">({t.chain})</span>
                    </span>
                    <span className="tabular-nums text-emerald-400/90">
                      {formatVol(t.total_amount)} · {t.flow_count} legs
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Trending accumulation"
            subtitle="Top destination tokens by volume"
            action={
              <Link href="/coins" className="text-[10px] font-medium text-[var(--b70-crypto-blue)] hover:underline">
                Coins
              </Link>
            }
          />
          <div className="p-4">
            {!summary?.top_destinations.length ? (
              <EmptyHint />
            ) : (
              <ul className="space-y-2">
                {summary.top_destinations.map((t) => (
                  <li
                    key={t.asset}
                    className="flex items-center justify-between rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/50 px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-[var(--b70-text)]">{t.asset}</span>
                    <span className="tabular-nums text-[var(--b70-text-muted)]">
                      {formatVol(t.total_amount)} · {t.flow_count} legs
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="By chain" subtitle="Share of flow amount in window" />
          <div className="p-4">
            {!summary?.by_chain.length ? (
              <EmptyHint />
            ) : (
              <ul className="space-y-2">
                {summary.by_chain.map((r) => (
                  <li
                    key={r.chain}
                    className="flex items-center justify-between rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/50 px-3 py-2 text-xs"
                  >
                    <span className="uppercase text-[var(--b70-text)]">{r.chain}</span>
                    <span className="tabular-nums text-[var(--b70-text-muted)]">
                      {formatVol(r.total_amount)} · {r.flow_count} legs
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="By category"
            subtitle="Mapped via coin metadata (top destinations sample)"
            action={
              <input
                placeholder="Filter…"
                value={catQ}
                onChange={(e) => setCatQ(e.target.value)}
                className="h-7 w-28 rounded border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 text-[10px] text-[var(--b70-text)] outline-none"
              />
            }
          />
          <div className="p-4">
            {!filteredCategories.length ? (
              <EmptyHint />
            ) : (
              <ul className="space-y-2">
                {filteredCategories.map((r) => (
                  <li
                    key={r.category}
                    className="flex items-center justify-between rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/50 px-3 py-2 text-xs"
                  >
                    <span className="text-[var(--b70-text)]">{r.category}</span>
                    <span className="tabular-nums text-[var(--b70-text-muted)]">
                      {formatVol(r.total_amount)} · {r.flow_count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Recent legs"
          subtitle="Latest raw rows in window"
          action={
            <Link
              href="/opportunities"
              className="text-[10px] font-medium text-[var(--b70-crypto-blue)] hover:underline"
            >
              Opportunities
            </Link>
          }
        />
        <div className="p-4">
          {summary?.disclaimer ? (
            <p className="mb-3 text-[10px] text-[var(--b70-text-muted)]">{summary.disclaimer}</p>
          ) : null}
          {!summary?.recent?.length ? (
            <EmptyHint />
          ) : (
            <ul className="space-y-2">
              {summary.recent.slice(0, 18).map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/50 px-3 py-2 text-xs"
                >
                  <span className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-text)]">
                    {f.source_asset} → {f.destination_asset}
                  </span>
                  <span className="text-[var(--b70-text-muted)]">
                    {formatVol(f.amount)} · {f.chain}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]/40 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--b70-text)]">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-[var(--b70-text-muted)]">{hint}</p> : null}
    </div>
  );
}

function EmptyHint() {
  return (
    <p className="text-xs text-[var(--b70-text-muted)]">
      No flows in this window yet. Data fills as the capital-flow engine ingests swaps, transfers, and
      bridges.
    </p>
  );
}
