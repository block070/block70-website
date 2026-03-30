import { API_BASE_URL } from "./api";

/** Browser uses same-origin Next proxy; server uses FastAPI base (see trading-strategies-api). */
export function leaderboardV1Base(): string {
  return typeof window !== "undefined"
    ? "/api/v1/leaderboard"
    : `${API_BASE_URL}/api/v1/leaderboard`;
}

export type TraderLeaderboardSort = "roi" | "win_rate";
export type TraderLeaderboardPeriod = "7d" | "30d" | "90d" | "all";

export type TraderLeaderboardEntry = {
  rank: number;
  user_id: number;
  name: string;
  roi: number;
  win_rate: number;
  total_trades: number;
  strategy_id: number;
  strategy_name: string;
  badges: string[];
};

export type UserTradingStats = {
  has_stats: boolean;
  roi?: number;
  win_rate?: number;
  total_trades?: number;
  strategy_id?: number;
  strategy_name?: string;
};

export async function getTradersLeaderboard(opts: {
  sort?: TraderLeaderboardSort;
  period?: TraderLeaderboardPeriod;
  strategyId?: number | null;
  publicOnly?: boolean;
  limit?: number;
}): Promise<TraderLeaderboardEntry[]> {
  const {
    sort = "roi",
    period = "all",
    strategyId = null,
    publicOnly = true,
    limit = 100,
  } = opts;
  const q = new URLSearchParams({
    sort,
    period,
    public_only: publicOnly ? "true" : "false",
    limit: String(limit),
  });
  if (strategyId != null) q.set("strategy_id", String(strategyId));
  const r = await fetch(
    `${leaderboardV1Base()}/traders?${q.toString()}`,
    { cache: "no-store" }
  );
  if (!r.ok) throw new Error("Traders leaderboard API error");
  const data = (await r.json()) as TraderLeaderboardEntry[];
  return Array.isArray(data) ? data : [];
}

export async function getUserTradingStats(
  userId: number
): Promise<UserTradingStats> {
  const r = await fetch(
    `${leaderboardV1Base()}/users/${userId}/trading-stats`,
    { cache: "no-store" }
  );
  if (!r.ok) throw new Error("User trading stats API error");
  return (await r.json()) as UserTradingStats;
}
