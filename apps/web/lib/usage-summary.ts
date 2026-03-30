import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

export type UsageSummaryResponse = {
  period: { start: string; end: string };
  plan: {
    type: string;
    status: string;
    current_period_end: string | null;
  };
  metrics: {
    api_calls: number;
    signals_used: number;
    ai_queries: number;
  };
  limits_display: {
    ai: {
      limit: number | null;
      remaining: number | null;
      unlimited: boolean;
    };
    signals: {
      limit: number | null;
      remaining: number | null;
      unlimited: boolean;
    };
  };
  quotas: {
    developer_keys: Array<{
      api_key_id: number;
      key_prefix: string;
      key_label: string | null;
      plan_type: string;
      usage_today: number;
      daily_limit: number | null;
      remaining_today: number | null;
      unlimited: boolean;
    }>;
    premium_api_calls_24h: number;
    premium_api_limit_24h: number | null;
  };
  billing: {
    estimated_monthly_usd: number;
    currency: string;
    note: string;
  };
  actions: {
    upgrade_plan: "pro" | "elite" | null;
    pricing_path: string;
    portal_return_path: string;
  };
};

export async function getUsageSummary(): Promise<UsageSummaryResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/usage/summary`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to load usage summary");
  }

  return (await res.json()) as UsageSummaryResponse;
}
