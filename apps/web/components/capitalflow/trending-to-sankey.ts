import type { CapitalFlowTrendingDto } from "@/lib/api";

export type SankeyChartData = {
  nodes: { name: string }[];
  links: { source: number; target: number; value: number }[];
};

/** Map aggregated flow edges to Recharts Sankey `data` shape. */
export function trendingToSankeyData(edges: CapitalFlowTrendingDto[]): SankeyChartData {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const e of edges) {
    for (const name of [e.source_asset, e.destination_asset]) {
      if (!seen.has(name)) {
        seen.add(name);
        ordered.push(name);
      }
    }
  }
  const index = new Map(ordered.map((name, i) => [name, i]));
  const nodes = ordered.map((name) => ({ name }));
  const links = edges
    .map((e) => {
      const s = index.get(e.source_asset);
      const t = index.get(e.destination_asset);
      if (s == null || t == null) return null;
      const value = Math.max(Number(e.total_amount) || 0, 1e-9);
      return { source: s, target: t, value };
    })
    .filter((x): x is { source: number; target: number; value: number } => x != null);
  return { nodes, links };
}
