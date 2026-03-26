"use client";

import { hierarchy, pack as d3pack } from "d3-hierarchy";
import { useMemo, useState } from "react";

import type { HourEntities } from "@/lib/crypto-hour-intelligence-types";
import type { IntelKeyword } from "@/lib/crypto-hour-intelligence-types";
import type { PublishedArticleDTO } from "@/lib/crypto-hour-dto";

const VIEW_W = 1000;
const VIEW_H = 520;

export type NarrativeMapMode = "words" | "coins" | "projects";

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

function countMentions(haystack: string, needle: string): number {
  if (!needle.trim()) return 0;
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(esc, "gi");
  return (haystack.match(re) ?? []).length;
}

function keywordsFromCoins(coins: string[], articles: PublishedArticleDTO[]): IntelKeyword[] {
  const blob = articles.map((a) => `${a.title}\n${a.body_markdown}`).join("\n");
  const out = coins.map((term) => {
    const c = Math.max(1, countMentions(blob, term) + countMentions(blob, term.toLowerCase()));
    return {
      term: term.toUpperCase(),
      count: c,
      sentiment: 0,
      categoryHint: "general" as const,
    };
  });
  return out.sort((a, b) => b.count - a.count).slice(0, 24);
}

function keywordsFromOrgs(orgs: string[], articles: PublishedArticleDTO[]): IntelKeyword[] {
  const blob = articles.map((a) => `${a.title}\n${a.body_markdown}`).join("\n");
  return orgs
    .map((term) => ({
      term,
      count: Math.max(1, countMentions(blob, term)),
      sentiment: 0,
      categoryHint: "general" as const,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);
}

export function NarrativeBubblePack({
  keywords,
  entities,
  articles,
  mode,
  activeTerm,
  onPick,
}: {
  keywords: IntelKeyword[];
  entities: HourEntities;
  articles: PublishedArticleDTO[];
  mode: NarrativeMapMode;
  activeTerm: string | null;
  onPick: (term: string | null) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const sourceKeywords = useMemo(() => {
    if (mode === "coins") return keywordsFromCoins(entities.coins, articles);
    if (mode === "projects") return keywordsFromOrgs(entities.organizations, articles);
    return keywords;
  }, [mode, keywords, entities.coins, entities.organizations, articles]);

  const leaves = useMemo(() => {
    const top = sourceKeywords.slice(0, 22);
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
      .size([VIEW_W - 8, VIEW_H - 8])
      .padding(3);
    const packed = layout(root as never);
    const raw = packed.leaves().map((leaf) => {
      const d = leaf.data as unknown as { term: string; count: number; sentiment: number };
      return {
        term: d.term,
        count: d.count,
        sentiment: d.sentiment,
        r: leaf.r,
        x: leaf.x + 4,
        y: leaf.y + 4,
      };
    });
    const byR = [...raw].sort((a, b) => b.r - a.r);
    const prominent = new Set(byR.slice(0, 5).map((l) => l.term));
    return raw.map((l) => ({
      ...l,
      r: prominent.has(l.term) ? Math.max(l.r, 36) : l.r,
    }));
  }, [sourceKeywords]);

  const modeLabel =
    mode === "words" ? "Keywords" : mode === "coins" ? "Coins" : "Projects & firms";

  if (!leaves.length) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-slate-800/80 bg-slate-950/50 text-sm text-slate-500">
        No {modeLabel} in this hour — try another mode or hour.
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-b from-[#0c1220] via-[#070a0f] to-[#0a0e14] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_20px_50px_rgba(0,0,0,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Narrative map · {modeLabel}
        </p>
        <p className="text-[10px] text-slate-500">
          Hover details · Click filters feed · Top terms stay legible
        </p>
      </div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block h-auto w-full min-h-[400px] max-h-[600px] transition-opacity duration-500"
        preserveAspectRatio="xMidYMid meet"
      >
        {leaves.map((l) => {
          const isOn = activeTerm === l.term || hover === l.term;
          const big =
            l.r >= 36 ||
            sourceKeywords.findIndex((k) => k.term === l.term) < 5;
          const fontPx = big ? Math.max(12, Math.min(20, l.r / 2.4)) : Math.min(11, l.r / 2.2);
          return (
            <g
              key={`${mode}-${l.term}`}
              transform={`translate(${l.x},${l.y})`}
              style={{ cursor: "pointer", transition: "transform 0.4s ease" }}
              onMouseEnter={() => setHover(l.term)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onPick(activeTerm === l.term ? null : l.term)}
            >
              <circle
                r={l.r}
                fill={sentimentFill(mode === "words" ? l.sentiment : 0, isOn)}
                stroke={isOn ? "rgba(251,191,36,0.95)" : "rgba(30,41,59,0.7)"}
                strokeWidth={isOn ? 2.5 : 1}
                className="transition-all duration-300"
              />
              {l.r > 12 ? (
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  className="pointer-events-none select-none fill-slate-950 font-semibold"
                  style={{ fontSize: fontPx }}
                >
                  {l.term.length > 14 ? `${l.term.slice(0, 12)}…` : l.term}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {(hover || activeTerm) && (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-lg border border-slate-600/50 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-200 shadow-xl backdrop-blur-md transition-opacity duration-200">
          {(() => {
            const k = sourceKeywords.find((x) => x.term === (hover || activeTerm));
            if (!k) return null;
            return (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-white">{k.term}</span>
                <span className="text-slate-400">{k.count} mentions</span>
                <span
                  className={
                    k.sentiment > 10
                      ? "text-emerald-400"
                      : k.sentiment < -10
                        ? "text-red-400"
                        : "text-slate-500"
                  }
                >
                  sentiment {k.sentiment.toFixed(0)}
                </span>
                <span className="text-slate-500">· {k.categoryHint}</span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export function NarrativeMapModeToggle({
  mode,
  onMode,
}: {
  mode: NarrativeMapMode;
  onMode: (m: NarrativeMapMode) => void;
}) {
  const opts: { id: NarrativeMapMode; label: string }[] = [
    { id: "words", label: "Words" },
    { id: "coins", label: "Coins" },
    { id: "projects", label: "Projects" },
  ];
  return (
    <div className="flex rounded-lg border border-slate-700/80 bg-slate-900/60 p-0.5">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onMode(o.id)}
          className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-all ${
            mode === o.id
              ? "bg-emerald-600/25 text-emerald-200 shadow-inner"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
