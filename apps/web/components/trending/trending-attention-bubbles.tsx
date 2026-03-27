"use client";

import { hierarchy, pack as d3pack } from "d3-hierarchy";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { EnrichedTrendingRow } from "@/lib/trending-metrics";

const VIEW_W = 960;
const VIEW_H = 420;

function changeFill(pct: number, active: boolean): string {
  const op = active ? 1 : 0.85;
  const p = Number.isFinite(pct) ? pct : 0;
  if (p > 2.5) return `rgba(52,211,153,${op})`;
  if (p < -2.5) return `rgba(248,113,113,${op})`;
  return `rgba(148,163,184,${op})`;
}

function fitLabel(symbol: string, r: number): { text: string; fontSize: number } | null {
  if (r < 11) return null;
  const maxW = 2 * r * 0.82;
  const hi = Math.min(14, r / 2.2);
  for (let fs = hi; fs >= 7; fs -= 0.75) {
    const charW = fs * 0.55;
    const maxChars = Math.max(2, Math.floor(maxW / charW));
    const truncated =
      symbol.length <= maxChars ? symbol : `${symbol.slice(0, Math.max(2, maxChars - 1))}…`;
    if (truncated.length * charW <= maxW * 1.05) {
      return { text: truncated, fontSize: fs };
    }
  }
  return { text: symbol.length > 4 ? `${symbol.slice(0, 3)}…` : symbol, fontSize: 7 };
}

type PackLeaf = {
  slug: string;
  symbol: string;
  attentionScore: number;
  change24h: number;
  r: number;
  x: number;
  y: number;
};

export function TrendingAttentionBubbles({ rows }: { rows: EnrichedTrendingRow[] }) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);

  const leaves = useMemo(() => {
    const top = rows.slice(0, 28);
    if (!top.length) return [] as PackLeaf[];
    const rootData = {
      name: "root",
      children: top.map((r) => ({
        name: r.coin.slug,
        value: Math.max(4, r.attentionScore),
        slug: r.coin.slug,
        symbol: r.coin.symbol,
        attentionScore: r.attentionScore,
        change24h: r.coin.change24hPct,
      })),
    };
    const root = hierarchy(rootData as unknown as { name: string; children: unknown[] })
      .sum((d) => ((d as { value?: number }).value ?? 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const layout = d3pack<{ name: string; value?: number }>()
      .size([VIEW_W - 8, VIEW_H - 8])
      .padding(3);
    const packed = layout(root as never);
    return packed.leaves().map((leaf) => {
      const d = leaf.data as unknown as {
        slug: string;
        symbol: string;
        attentionScore: number;
        change24h: number;
      };
      return {
        slug: d.slug,
        symbol: d.symbol,
        attentionScore: d.attentionScore,
        change24h: d.change24h,
        r: leaf.r,
        x: leaf.x + 4,
        y: leaf.y + 4,
      };
    });
  }, [rows]);

  if (!leaves.length) {
    return (
      <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]/60 px-4 py-10 text-center text-sm text-[var(--b70-text-muted)]">
        No coins to plot.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]/40 p-3 shadow-b70-card">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--b70-text-muted)]">
        Attention map
      </p>
      <p className="mb-3 text-xs text-[var(--b70-text-muted)]">
        Bubble size = attention score; color = 24h move (green up, red down, slate flat). Not financial
        advice.
      </p>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block h-auto w-full min-h-[280px] max-h-[520px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {leaves.map((l) => {
          const isOn = hover === l.slug;
          const label = fitLabel(l.symbol, l.r);
          return (
            <g
              key={l.slug}
              transform={`translate(${l.x},${l.y})`}
              style={{ cursor: "pointer", transition: "transform 0.25s ease" }}
              onMouseEnter={() => setHover(l.slug)}
              onMouseLeave={() => setHover(null)}
              onClick={() => router.push(`/coins/${encodeURIComponent(l.slug)}`)}
            >
              <circle
                r={l.r}
                fill={changeFill(l.change24h, isOn)}
                stroke={isOn ? "rgba(59,130,246,0.95)" : "rgba(51,65,85,0.6)"}
                strokeWidth={isOn ? 2.2 : 1}
                className="transition-all duration-300"
              />
              {label ? (
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  fill="rgba(255,255,255,0.94)"
                  className="pointer-events-none select-none font-semibold"
                  style={{
                    fontSize: label.fontSize,
                    paintOrder: "stroke fill",
                    stroke: "rgba(0,0,0,0.45)",
                    strokeWidth: 2,
                    strokeLinejoin: "round",
                  }}
                >
                  {label.text}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
