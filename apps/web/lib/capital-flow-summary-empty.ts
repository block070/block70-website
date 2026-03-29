import type { CapitalFlowSummaryDto } from "@/lib/api";

/** Valid JSON when the Python API cannot be reached so the dashboard can still render (demo for free users). */
export function emptyCapitalFlowSummary(
  hours: number,
  chain_filter: string | null,
  disclaimer: string,
): CapitalFlowSummaryDto {
  return {
    hours,
    chain_filter,
    total_volume: 0,
    dominant_chain: null,
    by_chain: [],
    by_category: [],
    top_destinations: [],
    hot_edges: [],
    recent: [],
    data_tier: "standard",
    disclaimer,
  };
}
