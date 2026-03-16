"use client";

import { useMemo } from "react";

export type FlowLink = {
  source_asset: string;
  destination_asset: string;
  chain: string;
  total_amount: number;
  flow_count?: number;
};

type CapitalFlowChartProps = {
  flows: FlowLink[];
  className?: string;
  maxNodes?: number;
};

/**
 * Renders capital flows as a network graph: nodes (assets) and links (amounts).
 * Can be styled as a simple Sankey-like view (left = source, right = destination).
 */
export function CapitalFlowChart({
  flows,
  className = "",
  maxNodes = 20,
}: CapitalFlowChartProps) {
  const { nodes, links, maxAmount } = useMemo(() => {
    const nodeSet = new Set<string>();
    const linkList: { source: string; target: string; amount: number; chain: string }[] = [];
    let maxAmt = 0;
    for (const f of flows.slice(0, maxNodes * 2)) {
      nodeSet.add(f.source_asset);
      nodeSet.add(f.destination_asset);
      linkList.push({
        source: f.source_asset,
        target: f.destination_asset,
        amount: f.total_amount,
        chain: f.chain,
      });
      if (f.total_amount > maxAmt) maxAmt = f.total_amount;
    }
    const nodes = Array.from(nodeSet);
    return { nodes, links: linkList, maxAmount: maxAmt || 1 };
  }, [flows, maxNodes]);

  if (nodes.length === 0) {
    return (
      <div
        className={`flex min-h-[200px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 text-sm text-slate-500 ${className}`}
      >
        No flow data to display
      </div>
    );
  }

  const rowHeight = 32;
  const leftX = 24;
  const rightX = 220;
  const width = 260;
  const height = Math.max(120, nodes.length * rowHeight);

  const sourceNodes = Array.from(new Set(links.map((l) => l.source)));
  const destNodes = Array.from(new Set(links.map((l) => l.target)));
  const getSourceY = (label: string) => {
    const i = sourceNodes.indexOf(label);
    return 24 + i * rowHeight;
  };
  const getDestY = (label: string) => {
    const i = destNodes.indexOf(label);
    return 24 + i * rowHeight;
  };

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        style={{ minHeight: height }}
      >
        {links.map((link, i) => {
          const thickness = Math.max(2, (link.amount / maxAmount) * 14);
          const y1 = getSourceY(link.source);
          const y2 = getDestY(link.target);
          const midX = (leftX + rightX) / 2;
          const path = `M ${leftX} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${rightX} ${y2}`;
          return (
            <path
              key={`${link.source}-${link.target}-${i}`}
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth={thickness}
              strokeOpacity={0.4}
              className="text-emerald-500"
            />
          );
        })}
        {sourceNodes.map((label, i) => (
          <g key={`left-${label}`}>
            <circle
              cx={leftX}
              cy={24 + i * rowHeight}
              r={8}
              className="fill-slate-700 text-slate-400"
            />
            <text
              x={leftX - 10}
              y={24 + i * rowHeight}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-slate-300 text-[10px]"
            >
              {label}
            </text>
          </g>
        ))}
        {destNodes.map((label, i) => (
          <g key={`right-${label}`}>
            <circle
              cx={rightX}
              cy={24 + i * rowHeight}
              r={8}
              className="fill-slate-600 text-slate-400"
            />
            <text
              x={rightX + 10}
              y={24 + i * rowHeight}
              textAnchor="start"
              dominantBaseline="middle"
              className="fill-slate-300 text-[10px]"
            >
              {label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
