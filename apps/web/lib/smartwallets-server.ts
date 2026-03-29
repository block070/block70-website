import "server-only";

import { smartMoneyWallets } from "@/data/smartMoneyWallets";
import {
  getApiBaseUrl,
  getSmartWallets,
  getWalletLeaderboard,
  type SmartWalletDto,
} from "@/lib/api";

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

/** Curated demo addresses when API is down or returns no smart-wallet rows (plan: fallback). */
function fromSeed(): WhaleDirectoryRow[] {
  return smartMoneyWallets.map((w) => ({
    wallet_address: w.address,
    chain: w.chain,
    reputation_score: w.score / 100,
    profitability_score: w.score / 100,
  }));
}

export async function loadWhaleDirectory(): Promise<WhaleDirectoryRow[]> {
  const settled = await Promise.allSettled([
    getSmartWallets({ limit: 100 }),
    getWalletLeaderboard(),
  ]);

  const smart = settled[0].status === "fulfilled" ? settled[0].value : [];
  const leaderboard = settled[1].status === "fulfilled" ? settled[1].value : [];

  // #region agent log
  {
    let apiHost = "";
    try {
      apiHost = new URL(getApiBaseUrl() || "http://localhost").hostname;
    } catch {
      apiHost = "invalid-base";
    }
    const smartRej =
      settled[0].status === "rejected" ? String(settled[0].reason).slice(0, 200) : null;
    const lbRej =
      settled[1].status === "rejected" ? String(settled[1].reason).slice(0, 200) : null;
    void fetch("http://127.0.0.1:7428/ingest/b2bee36a-3f9b-42a9-b6fb-0dc54bacc543", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9aa1f6" },
      body: JSON.stringify({
        sessionId: "9aa1f6",
        runId: "directory-load",
        hypothesisId: "H_api_sources",
        location: "smartwallets-server.ts:loadWhaleDirectory",
        message: "whale directory API sources",
        data: {
          apiHost,
          smartStatus: settled[0].status,
          smartLen: smart.length,
          smartReject: smartRej,
          leaderboardStatus: settled[1].status,
          leaderboardLen: leaderboard.length,
          leaderboardReject: lbRej,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  let rows: WhaleDirectoryRow[];
  if (smart.length > 0) {
    rows = smart.map(fromSmart);
  } else if (leaderboard.length > 0) {
    rows = leaderboard.map((w) => ({
      wallet_address: w.wallet_address,
      chain: "solana",
      win_rate: w.win_rate,
      average_roi: w.average_roi,
      reputation_score: w.win_rate,
      profitability_score: w.average_roi,
      total_profit_usd: w.total_profit_usd,
      recent_opportunity_count: w.recent_opportunity_count,
    }));
  } else {
    rows = fromSeed();
  }

  // #region agent log
  void fetch("http://127.0.0.1:7428/ingest/b2bee36a-3f9b-42a9-b6fb-0dc54bacc543", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9aa1f6" },
    body: JSON.stringify({
      sessionId: "9aa1f6",
      runId: "directory-load",
      hypothesisId: "H_rows_out",
      location: "smartwallets-server.ts:loadWhaleDirectory",
      message: "whale directory result",
      data: {
        outLen: rows.length,
        usedSeed: smart.length === 0 && leaderboard.length === 0,
        usedSmart: smart.length > 0,
        usedLeaderboard: smart.length === 0 && leaderboard.length > 0,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return rows;
}
