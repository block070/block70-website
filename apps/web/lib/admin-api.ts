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

export type ExchangeAffiliateRow = {
  id: number;
  provider_key: string;
  venue_type: string;
  display_name: string;
  url_template: string | null;
  is_active: boolean;
  notes: string | null;
  updated_at: string | null;
};

export async function listExchangeAffiliateLinks(): Promise<{ items: ExchangeAffiliateRow[] }> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE_URL}/api/v1/admin/exchange-affiliate-links`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Admin API error: " + res.status);
  return (await res.json()) as { items: ExchangeAffiliateRow[] };
}

export async function upsertExchangeAffiliateLink(
  providerKey: string,
  body: {
    display_name: string;
    venue_type?: string;
    url_template: string | null;
    is_active: boolean;
    notes?: string | null;
  }
): Promise<ExchangeAffiliateRow> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(
    `${API_BASE_URL}/api/v1/admin/exchange-affiliate-links/${encodeURIComponent(providerKey)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error("Admin API error: " + res.status);
  return (await res.json()) as ExchangeAffiliateRow;
}

export async function createExchangeAffiliateLink(body: {
  provider_key: string;
  display_name: string;
  venue_type?: string;
  url_template: string | null;
  is_active: boolean;
  notes?: string | null;
}): Promise<ExchangeAffiliateRow> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE_URL}/api/v1/admin/exchange-affiliate-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Admin API error: " + res.status);
  return (await res.json()) as ExchangeAffiliateRow;
}

export async function deleteExchangeAffiliateLink(providerKey: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(
    `${API_BASE_URL}/api/v1/admin/exchange-affiliate-links/${encodeURIComponent(providerKey)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) throw new Error("Admin API error: " + res.status);
}
