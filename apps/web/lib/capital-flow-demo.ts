import type { CapitalFlowSummaryDto } from "@/lib/api";

/**
 * Illustrative flows when the ledger has no rows yet (local/dev).
 * Not real market data—UI-only teaching sample.
 */
export function buildDemoCapitalFlowSummary(
  hours: number,
  chain_filter: string | null,
): CapitalFlowSummaryDto {
  /** Richer totals for longer windows (30d vs 24h) while staying illustrative. */
  const windowScale = Math.max(1, Math.sqrt(hours / 24));

  const allEdges = [
    {
      source_asset: "USDC",
      destination_asset: "ETH",
      chain: "ethereum",
      total_amount: 2.8e8 * windowScale,
      flow_count: Math.max(120, Math.round(1240 * windowScale)),
    },
    {
      source_asset: "ETH",
      destination_asset: "WBTC",
      chain: "ethereum",
      total_amount: 1.55e8 * windowScale,
      flow_count: Math.max(80, Math.round(612 * windowScale)),
    },
    {
      source_asset: "SOL",
      destination_asset: "JUP",
      chain: "solana",
      total_amount: 9.5e7 * windowScale,
      flow_count: Math.max(80, Math.round(890 * windowScale)),
    },
    {
      source_asset: "USDT",
      destination_asset: "SOL",
      chain: "solana",
      total_amount: 7.2e7 * windowScale,
      flow_count: Math.max(60, Math.round(540 * windowScale)),
    },
    {
      source_asset: "BTC",
      destination_asset: "WBTC",
      chain: "bitcoin",
      total_amount: 4.1e7 * windowScale,
      flow_count: Math.max(40, Math.round(210 * windowScale)),
    },
    {
      source_asset: "ETH",
      destination_asset: "USDC",
      chain: "ethereum",
      total_amount: 3.3e7 * windowScale,
      flow_count: Math.max(100, Math.round(980 * windowScale)),
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
    { category: "Layer 1", total_amount: 1.65e8 * windowScale, flow_count: Math.round(1100 * windowScale) },
    { category: "DeFi", total_amount: 2.8e8 * windowScale, flow_count: Math.round(1240 * windowScale) },
    { category: "Stablecoins", total_amount: 9.5e7 * windowScale, flow_count: Math.round(890 * windowScale) },
  ].sort((a, b) => b.total_amount - a.total_amount);

  const now = Date.now();
  const spanMs = Math.min(hours * 60 * 60 * 1000, 30 * 24 * 60 * 60 * 1000);
  const recent = [
    {
      id: -1,
      source_asset: "USDC",
      destination_asset: "ETH",
      amount: 1.2e6 * windowScale,
      chain: "ethereum",
      timestamp: new Date(now - spanMs * 0.15).toISOString(),
    },
    {
      id: -2,
      source_asset: "SOL",
      destination_asset: "JUP",
      amount: 4.5e5 * windowScale,
      chain: "solana",
      timestamp: new Date(now - spanMs * 0.55).toISOString(),
    },
    {
      id: -3,
      source_asset: "ETH",
      destination_asset: "WBTC",
      amount: 8.8e5 * windowScale,
      chain: "ethereum",
      timestamp: new Date(now - spanMs * 0.88).toISOString(),
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
      "Illustrative data only—not ingested on-chain flows. Live rows appear when the capital-flow pipeline writes to capital_flows.",
  };
}
