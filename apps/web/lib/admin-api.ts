import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

export type GrowthAnalytics = {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  dau: number;
  notifications_7d: number;
  referrals_7d: number;
};

export async function getGrowthAnalytics(): Promise<GrowthAnalytics> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE_URL}/api/v1/admin/analytics`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Admin API error: " + res.status);
  return (await res.json()) as GrowthAnalytics;
}

export type BotPerformanceEntry = {
  bot_id: number;
  platform: string;
  channel_id: string;
  is_active: boolean;
  signals_sent_24h: number;
  signals_sent_7d: number;
  clicks_7d: number;
};

export async function getBotsPerformance(): Promise<{ bots: BotPerformanceEntry[] }> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE_URL}/api/v1/admin/bots`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Admin API error: " + res.status);
  return (await res.json()) as { bots: BotPerformanceEntry[] };
}
