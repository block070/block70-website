import { API_BASE_URL } from "./api";

export type TokenWatchDto = {
  id: number;
  user_identifier: string;
  token_symbol: string;
  created_at: string;
};

/**
 * Lists server-side token watches for a user (matches Copilot engine TokenWatch.user_identifier).
 */
export async function listTokenWatchesForUser(userId: number): Promise<TokenWatchDto[]> {
  if (!API_BASE_URL) {
    return [];
  }
  const params = new URLSearchParams({ user_identifier: String(userId) });
  const res = await fetch(`${API_BASE_URL}/api/v1/token-watch?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Token watch API error: ${res.status}`);
  return (await res.json()) as TokenWatchDto[];
}
