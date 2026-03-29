import type { CapitalFlowSummaryDto } from "@/lib/api";

/**
 * Illustrative flows when the ledger has no rows yet (local/dev).
 * Not real market data—UI-only teaching sample.
 */
export function buildDemoCapitalFlowSummary(
  hours: number,
  chain_filter: string | null,
): CapitalFlowSummaryDto {
  const allEdges = [
    {
      source_asset: "USDC",
      destination_asset: "ETH",
      chain: "ethereum",
      total_amount: 2.8e8,
      flow_count: 1240,
    },
    {
      source_asset: "ETH",
      destination_asset: "WBTC",
      chain: "ethereum",
      total_amount: 1.55e8,
      flow_count: 612,
    },
    {
      source_asset: "SOL",
      destination_asset: "JUP",
      chain: "solana",
      total_amount: 9.5e7,
      flow_count: 890,
    },
    {
      source_asset: "USDT",
      destination_asset: "SOL",
      chain: "solana",
      total_amount: 7.2e7,
      flow_count: 540,
    },
    {
      source_asset: "BTC",
      destination_asset: "WBTC",
      chain: "bitcoin",
      total_amount: 4.1e7,
      flow_count: 210,
    },
    {
      source_asset: "ETH",
      destination_asset: "USDC",
      chain: "ethereum",
      total_amount: 3.3e7,
      flow_count: 980,
    },
  ];

  const hot_edges = chain_filter
    ? allEdges.filter((e) => e.chain.toLowerCase() === chain_filter.toLowerCase())
    : allEdges;
  const edges = hot_edges.length ? hot_edges : allEdges;

  const chainMap = new Map<string, { total: number; cnt: number }>();
  for (const e of edges) {
    const cur = chainMap.get(e.chain) ?? { total: 0, cnt: 0 };
    cur.total += e.total_amount;
    cur.cnt += e.flow_count;
    chainMap.set(e.chain, cur);
  }
  const by_chain = [...chainMap.entries()]
    .map(([chain, v]) => ({
      chain,
      total_amount: v.total,
      flow_count: v.cnt,
    }))
    .sort((a, b) => b.total_amount - a.total_amount);

  const destMap = new Map<string, { total: number; cnt: number }>();
  for (const e of edges) {
    const cur = destMap.get(e.destination_asset) ?? { total: 0, cnt: 0 };
    cur.total += e.total_amount;
    cur.cnt += e.flow_count;
    destMap.set(e.destination_asset, cur);
  }
  const top_destinations = [...destMap.entries()]
    .map(([asset, v]) => ({
      asset,
      total_amount: v.total,
      flow_count: v.cnt,
    }))
    .sort((a, b) => b.total_amount - a.total_amount)
    .slice(0, 12);

  const total_volume = edges.reduce((s, e) => s + e.total_amount, 0);
  const dominant_chain = by_chain[0] ? { ...by_chain[0] } : null;

  const by_category = [
    { category: "Layer 1", total_amount: 1.65e8, flow_count: 1100 },
    { category: "DeFi", total_amount: 2.8e8, flow_count: 1240 },
    { category: "Stablecoins", total_amount: 9.5e7, flow_count: 890 },
  ].sort((a, b) => b.total_amount - a.total_amount);

  const recent = [
    {
      id: -1,
      source_asset: "USDC",
      destination_asset: "ETH",
      amount: 1.2e6,
      chain: "ethereum",
      timestamp: new Date().toISOString(),
    },
    {
      id: -2,
      source_asset: "SOL",
      destination_asset: "JUP",
      amount: 4.5e5,
      chain: "solana",
      timestamp: new Date().toISOString(),
    },
  ];

  return {
    hours,
    chain_filter,
    total_volume,
    dominant_chain,
    by_chain,
    by_category,
    top_destinations,
    hot_edges: edges,
    recent,
    disclaimer:
      "Sample rows for empty ledger—replace with real data when the capital-flow engine ingests activity.",
  };
}
