import "server-only";

import { getSmartWallets, getWalletLeaderboard, type SmartWalletDto } from "@/lib/api";

/** Normalized row for whale directory table (smart API or leaderboard fallback). */
export type WhaleDirectoryRow = {
  wallet_address: string;
  chain: string;
  reputation_score?: number;
  profitability_score?: number;
  average_roi?: number;
  win_rate?: number;
  total_profit_usd?: number;
  recent_opportunity_count?: number;
  id?: number;
  created_at?: string | null;
};

function fromSmart(dto: SmartWalletDto): WhaleDirectoryRow {
  return {
    id: dto.id,
    wallet_address: dto.wallet_address,
    chain: dto.chain || "solana",
    reputation_score: dto.reputation_score,
    profitability_score: dto.profitability_score,
    created_at: dto.created_at ?? null,
  };
}

export async function loadWhaleDirectory(): Promise<WhaleDirectoryRow[]> {
  let smart: SmartWalletDto[] = [];
  let leaderboard: Awaited<ReturnType<typeof getWalletLeaderboard>> = [];
  try {
    [smart, leaderboard] = await Promise.all([
      getSmartWallets({ limit: 100 }),
      getWalletLeaderboard(),
    ]);
  } catch {
    /* partial */
  }

  if (smart.length > 0) return smart.map(fromSmart);

  return leaderboard.map((w) => ({
    wallet_address: w.wallet_address,
    chain: "solana",
    win_rate: w.win_rate,
    average_roi: w.average_roi,
    reputation_score: w.win_rate,
    profitability_score: w.average_roi,
    total_profit_usd: w.total_profit_usd,
    recent_opportunity_count: w.recent_opportunity_count,
  }));
}
