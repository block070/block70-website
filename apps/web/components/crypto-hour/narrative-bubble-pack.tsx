"use client";

import { hierarchy, pack as d3pack } from "d3-hierarchy";
import { useMemo, useState } from "react";

import type { IntelKeyword } from "@/lib/crypto-hour-intelligence-types";

const W = 340;
const H = 300;

function sentimentFill(s: number, active: boolean): string {
  const op = active ? 1 : 0.82;
  if (s > 8) return `rgba(34,197,94,${op})`;
  if (s < -8) return `rgba(239,68,68,${op})`;
  return `rgba(148,163,184,${op})`;
}

type PackLeaf = {
  term: string;
  count: number;
  sentiment: number;
  r: number;
  x: number;
  y: number;
};

export function NarrativeBubblePack({
  keywords,
  activeTerm,
  onPick,
}: {
  keywords: IntelKeyword[];
  activeTerm: string | null;
  onPick: (term: string | null) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const leaves = useMemo(() => {
    const top = keywords.slice(0, 20);
    if (!top.length) return [] as PackLeaf[];
    const rootData = {
      name: "root",
      children: top.map((k) => ({
        name: k.term,
        value: Math.max(1, k.count),
        term: k.term,
        count: k.count,
        sentiment: k.sentiment,
      })),
    };
    const root = hierarchy(rootData as unknown as { name: string; children: unknown[] })
      .sum((d) => ((d as { value?: number }).value ?? 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const layout = d3pack<{ name: string; value?: number }>()
      .size([W - 4, H - 4])
      .padding(2);
    const packed = layout(root as never);
    const out: PackLeaf[] = [];
    for (const leaf of packed.leaves()) {
      const d = leaf.data as unknown as {
        term: string;
        count: number;
        sentiment: number;
      };
      out.push({
        term: d.term,
        count: d.count,
        sentiment: d.sentiment,
        r: leaf.r,
        x: leaf.x + 2,
        y: leaf.y + 2,
      });
    }
    return out;
  }, [keywords]);

  if (!leaves.length) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-xl border border-slate-800/80 bg-slate-950/40 text-xs text-slate-500">
        No keyword signal for this hour yet.
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-slate-800/80 bg-gradient-to-b from-slate-950/60 to-slate-900/40 p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
        Narrative map
      </p>
      <svg
        width={W}
        height={H}
        className="mx-auto block overflow-visible"
        style={{ transition: "opacity 0.35s ease" }}
      >
        {leaves.map((l) => {
          const isOn = activeTerm === l.term || hover === l.term;
          return (
            <g
              key={l.term}
              transform={`translate(${l.x},${l.y})`}
              style={{ cursor: "pointer", transition: "transform 0.35s ease" }}
              onMouseEnter={() => setHover(l.term)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick(activeTerm === l.term ? null : l.term)}
            >
              <circle
                r={l.r}
                fill={sentimentFill(l.sentiment, isOn)}
                stroke={isOn ? "rgba(251,191,36,0.9)" : "rgba(15,23,42,0.6)"}
                strokeWidth={isOn ? 2 : 1}
                style={{ transition: "r 0.35s ease, fill 0.35s ease" }}
              />
              {l.r > 14 ? (
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  className="pointer-events-none select-none fill-slate-950 text-[9px] font-semibold"
                  style={{ fontSize: Math.min(11, l.r / 2.2) }}
                >
                  {l.term.length > 12 ? `${l.term.slice(0, 10)}…` : l.term}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {(hover || activeTerm) && (
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-lg border border-slate-700/50 bg-slate-950/90 px-2 py-1.5 text-[10px] text-slate-300 backdrop-blur-sm">
          {(() => {
            const k = keywords.find((x) => x.term === (hover || activeTerm));
            if (!k) return null;
            return (
              <div className="space-y-0.5">
                <span className="font-medium text-slate-100">{k.term}</span>
                <span className="text-slate-500">
                  {" "}
                  · {k.count} mentions · sentiment {k.sentiment.toFixed(0)}
                </span>
                <div className="text-slate-500">Category: {k.categoryHint}</div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
