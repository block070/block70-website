"use client";

import dynamic from "next/dynamic";
import { clsx } from "clsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { MacroDashboardPayload } from "@/lib/market/build-macro-dashboard";
import { formatChangePct, formatCompactUsd } from "@/lib/format";

const MarketHeatmap = dynamic(
  () => import("@/components/market/market-heatmap").then((m) => ({ default: m.MarketHeatmap })),
  {
    ssr: false,
    loading: () => (
      <div className="b70-dash-skeleton h-[400px] w-full rounded-xl border border-[var(--b70-border)]" />
    ),
  },
);

const PIE_COLORS = ["#f7931a", "#627eea", "#94a3b8"];

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

function formatHistoricalCell(
  m: MacroDashboardPayload["historical"][0],
  kind: "now" | "prior",
): string {
  const v = kind === "now" ? m.now : m.impliedPrior;
  if (v == null || !Number.isFinite(v)) return "—";
  if (m.unit === "compact") return formatCompactUsd(v);
  if (m.unit === "pct") return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  return String(v);
}

function FearGreedGauge({ value, label, source }: { value: number; label: string; source: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-3">
      <div className="relative h-3 overflow-hidden rounded-full bg-[var(--b70-border)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-[family-name:var(--font-jetbrains)] text-3xl font-semibold text-[var(--b70-text)]">
            {Math.round(pct)}
          </p>
          <p className="text-xs font-medium capitalize text-[var(--b70-text-muted)]">{label}</p>
        </div>
        <p className="text-[10px] text-[var(--b70-text-muted)]">
          {source === "alternative_me" ? "Alternative.me F&G" : "Synthetic (24h moves)"}
        </p>
      </div>
    </div>
  );
}

type Props = {
  data: MacroDashboardPayload;
};

export function MacroIntelligenceDashboard({ data }: Props) {
  const { global, dominancePie, categoryDominance, rotation, heatmapCoins, fearGreed, scatter, historical } =
    data;

  const scatterData = scatter.filter((d) => d.volume24h > 0);
  const maxShare = categoryDominance.reduce((m, r) => Math.max(m, r.sharePct), 1);

  return (
    <div className="space-y-10 pb-16 pt-2">
      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
          Macro intelligence
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          Crypto funds dashboard
        </h1>
        <p className="max-w-2xl text-sm text-[var(--b70-text-muted)]">
          Dominance, sector rotation, tape heat, and sentiment—aggregated for a macro read across the full
          complex.
        </p>
        <p className="text-[11px] text-[var(--b70-text-muted)]">
          Data as of {data.meta.marketAsOf ?? "—"} · Source {data.meta.marketSource}
        </p>
      </header>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total market cap" value={formatCompactUsd(global.totalMarketCapUsd ?? 0)} />
        <KpiCard label="24h volume" value={formatCompactUsd(global.totalVolumeUsd ?? 0)} />
        <KpiCard
          label="BTC dominance"
          value={global.btcDominancePct != null ? `${global.btcDominancePct.toFixed(1)}%` : "—"}
        />
        <KpiCard
          label="ETH dominance"
          value={global.ethDominancePct != null ? `${global.ethDominancePct.toFixed(1)}%` : "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
          <SectionTitle kicker="Structure" title="BTC / ETH / Other" />
          {dominancePie.length === 0 ? (
            <p className="text-xs text-[var(--b70-text-muted)]">No dominance data.</p>
          ) : (
            <div className="h-[280px] min-h-[200px] min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <PieChart>
                  <Pie
                    data={dominancePie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {dominancePie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--b70-card)",
                      border: "1px solid var(--b70-border)",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, "Share"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
          <SectionTitle kicker="Sectors" title="Category dominance (% of mcap)" />
          {categoryDominance.length === 0 ? (
            <p className="text-xs text-[var(--b70-text-muted)]">No category directory yet.</p>
          ) : (
            <div className="h-[280px] min-h-[200px] min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <BarChart layout="vertical" data={categoryDominance} margin={{ left: 4, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--b70-border)" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, Math.max(8, Math.ceil(maxShare))]}
                    tick={{ fill: "var(--b70-text-muted)", fontSize: 10 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fill: "var(--b70-text-muted)", fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--b70-card)",
                      border: "1px solid var(--b70-border)",
                      borderRadius: "8px",
                    }}
                    formatter={(value, _name, item) => {
                      const payload = item && typeof item === "object" && "payload" in item ? (item as { payload?: { change24h?: number | null } }).payload : undefined;
                      const ch = payload?.change24h;
                      const chStr =
                        typeof ch === "number" && Number.isFinite(ch) ? ` · 24h ${formatChangePct(ch)}` : "";
                      return [`${Number(value).toFixed(1)}%${chStr}`, "Share"];
                    }}
                  />
                  <Bar dataKey="sharePct" radius={[0, 4, 4, 0]} fill="var(--b70-crypto-blue)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
          <SectionTitle kicker="Rotation" title="Sector capital & momentum" />
          {rotation.length === 0 ? (
            <p className="text-xs text-[var(--b70-text-muted)]">No sector snapshot.</p>
          ) : (
            <ul className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {rotation.map((s) => (
                <li
                  key={s.id}
                  className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--b70-text)]">{s.name}</span>
                    <span
                      className={clsx(
                        "font-[family-name:var(--font-jetbrains)]",
                        typeof s.market_cap_change_24h === "number" && s.market_cap_change_24h >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {typeof s.market_cap_change_24h === "number"
                        ? formatChangePct(s.market_cap_change_24h)
                        : "—"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[var(--b70-text-muted)]">
                    <span className="rounded border border-[var(--b70-border)] px-1.5 py-0.5 uppercase">
                      {s.capital_flow}
                    </span>
                    <span className="rounded border border-[var(--b70-border)] px-1.5 py-0.5 capitalize">
                      {s.trend}
                    </span>
                    <span>Vol/mcap {(s.vol_to_mcap * 100).toFixed(1)}%</span>
                  </div>
                  <p className="mt-1.5 leading-relaxed text-[var(--b70-text-muted)]">{s.narrative}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
          <SectionTitle kicker="Lens" title="Now vs ~24h implied (estimated)" />
          <p className="mb-3 text-[11px] leading-relaxed text-[var(--b70-text-muted)]">
            “Prior” uses mcap-weighted 24h moves on the liquid sleeve—useful when history APIs are not wired.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--b70-border)] text-[var(--b70-text-muted)]">
                  <th className="py-2 pr-2 font-medium">Metric</th>
                  <th className="py-2 pr-2 font-[family-name:var(--font-jetbrains)] font-medium">Now</th>
                  <th className="py-2 font-[family-name:var(--font-jetbrains)] font-medium">~24h ago</th>
                </tr>
              </thead>
              <tbody className="text-[var(--b70-text)]">
                {historical.map((m) => (
                  <tr key={m.key} className="border-b border-[var(--b70-border)]/60">
                    <td className="py-2 pr-2 text-[var(--b70-text-muted)]">{m.label}</td>
                    <td className="py-2 pr-2 font-[family-name:var(--font-jetbrains)]">
                      {formatHistoricalCell(m, "now")}
                    </td>
                    <td className="py-2 font-[family-name:var(--font-jetbrains)] text-[var(--b70-text-muted)]">
                      {m.impliedPrior == null ? "—" : formatHistoricalCell(m, "prior")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <MarketHeatmap coins={heatmapCoins} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
          <SectionTitle kicker="Sentiment" title="Fear & greed style index" />
          <FearGreedGauge
            value={fearGreed.current.value}
            label={fearGreed.current.classification}
            source={fearGreed.current.source}
          />
          {fearGreed.previous ? (
            <p className="mt-4 text-xs text-[var(--b70-text-muted)]">
              Prior reading:{" "}
              <span className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-text)]">
                {fearGreed.previous.value}
              </span>{" "}
              ({fearGreed.previous.classification})
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
          <SectionTitle kicker="Liquidity" title="Volume vs 24h move" />
          {scatterData.length === 0 ? (
            <p className="text-xs text-[var(--b70-text-muted)]">No scatter points.</p>
          ) : (
            <div className="h-[320px] min-h-[200px] min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--b70-border)" />
                  <XAxis
                    type="number"
                    dataKey="volume24h"
                    name="Volume"
                    scale="log"
                    domain={["auto", "auto"]}
                    tick={{ fill: "var(--b70-text-muted)", fontSize: 10 }}
                    tickFormatter={(v) => formatCompactUsd(Number(v))}
                  />
                  <YAxis
                    type="number"
                    dataKey="change24h"
                    name="24h %"
                    tick={{ fill: "var(--b70-text-muted)", fontSize: 10 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <ZAxis type="number" dataKey="marketCap" range={[40, 400]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      background: "var(--b70-card)",
                      border: "1px solid var(--b70-border)",
                      borderRadius: "8px",
                    }}
                    formatter={(value, name) => {
                      if (name === "24h %") return [formatChangePct(Number(value)), String(name)];
                      if (name === "Volume") return [formatCompactUsd(Number(value)), String(name)];
                      return [String(value), String(name)];
                    }}
                    labelFormatter={(_, payload) => {
                      const p0 = Array.isArray(payload) ? payload[0] : undefined;
                      const sym =
                        p0 && typeof p0 === "object" && "payload" in p0
                          ? (p0 as { payload?: { symbol?: string } }).payload?.symbol
                          : undefined;
                      return sym ? String(sym) : "";
                    }}
                  />
                  <Scatter
                    name="Coins"
                    data={scatterData}
                    fill="var(--b70-crypto-blue)"
                    fillOpacity={0.65}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-[10px] text-[var(--b70-text-muted)]">
            Bubble area ∝ market cap (qualitative). Log scale on volume pulls in majors and long-tail alts.
          </p>
        </div>
      </div>

      <p className="text-[10px] text-[var(--b70-text-muted)]">
        Generated {new Date(data.meta.generatedAt).toLocaleString()} · For informational use only.
      </p>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-jetbrains)] text-lg font-semibold text-[var(--b70-text)]">
        {value}
      </p>
    </div>
  );
}
