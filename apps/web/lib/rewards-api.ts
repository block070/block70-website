import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

async function fetchWithAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  // Use same-origin proxy for blocks/balance to avoid CORS and mixed content (HTTPS → HTTP).
  const url =
    path === "/api/v1/blocks/balance" && typeof window !== "undefined"
      ? "/api/blocks/balance"
      : `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return (await res.json()) as T;
}

export type BlocksBalance = {
  balance: number;
  streak_days: number;
  last_checkin_at: string | null;
};

export type BlockTransactionDto = {
  id: number;
  transaction_type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

export async function getBlocksBalance(): Promise<BlocksBalance> {
  return fetchWithAuth<BlocksBalance>("/api/v1/blocks/balance");
}

export async function getBlocksTransactions(params?: {
  limit?: number;
  offset?: number;
}): Promise<BlockTransactionDto[]> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  const r = await fetchWithAuth<BlockTransactionDto[]>(
    `/api/v1/blocks/transactions?${q.toString()}`
  );
  return Array.isArray(r) ? r : [];
}

export type CheckinResult = {
  blocks_awarded: number;
  streak_days: number;
  message: string;
};

export async function postCheckin(): Promise<CheckinResult> {
  return fetchWithAuth<CheckinResult>("/api/v1/rewards/checkin", {
    method: "POST",
  });
}

export type RewardItemDto = {
  id: number;
  name: string;
  description: string | null;
  block_cost: number;
  reward_type: string;
};

export async function getRewardStore(): Promise<RewardItemDto[]> {
  const r = await fetchWithAuth<RewardItemDto[]>("/api/v1/rewards/store");
  return Array.isArray(r) ? r : [];
}

export async function redeemReward(itemId: number): Promise<{
  success: boolean;
  message: string;
  balance: number;
}> {
  return fetchWithAuth(`/api/v1/rewards/redeem/${itemId}`, {
    method: "POST",
  });
}

export type LeaderboardEntry = {
  rank: number;
  user_id: number;
  name: string;
  balance: number;
};

export async function getBlocksLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  const r = await fetch(
    `${API_BASE_URL}/api/v1/leaderboard/blocks?limit=${limit}`,
    { cache: "no-store" }
  );
  if (!r.ok) throw new Error("Leaderboard API error");
  const data = (await r.json()) as LeaderboardEntry[];
  return Array.isArray(data) ? data : [];
}
