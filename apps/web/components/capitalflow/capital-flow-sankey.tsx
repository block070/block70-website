"use client";

import { useMemo } from "react";
import { ResponsiveContainer, Sankey, Tooltip } from "recharts";

import type { CapitalFlowTrendingDto } from "@/lib/api";

import { trendingToSankeyData } from "./trending-to-sankey";

type Props = {
  edges: CapitalFlowTrendingDto[];
  className?: string;
};

export function CapitalFlowSankey({ edges, className = "" }: Props) {
  const data = useMemo(() => trendingToSankeyData(edges.slice(0, 40)), [edges]);

  if (data.nodes.length === 0 || data.links.length === 0) {
    return (
      <div
        className={`flex min-h-[220px] items-center justify-center rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]/40 text-xs text-[var(--b70-text-muted)] ${className}`}
      >
        Not enough flow edges to draw a Sankey. Data appears as the ledger fills.
      </div>
    );
  }

  return (
    <div className={`h-[320px] w-full min-h-[220px] min-w-0 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
          nodePadding={12}
          link={{ stroke: "var(--b70-crypto-blue)", strokeOpacity: 0.35 }}
          node={{ stroke: "var(--b70-border)", fill: "var(--b70-card)" }}
        >
          <Tooltip
            contentStyle={{
              background: "var(--b70-bg)",
              border: "1px solid var(--b70-border)",
              borderRadius: 8,
              fontSize: 11,
            }}
            formatter={(value) =>
              [typeof value === "number" ? value.toLocaleString() : String(value ?? ""), "Flow"] as const
            }
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
