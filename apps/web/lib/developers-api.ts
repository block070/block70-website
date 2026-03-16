import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

async function fetchWithAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE_URL}${path}`, {
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

export type ApiKeyInfo = {
  id: number;
  key_prefix: string;
  plan_type: string;
  rate_limit: number;
  is_active: boolean;
  created_at: string;
  last_used: string | null;
  usage_today: number;
};

export type CreateKeyResponse = {
  id: number;
  key_prefix: string;
  raw_key: string;
  plan_type: string;
  rate_limit: number;
  created_at: string;
  message: string;
};

export async function createApiKey(planType = "free"): Promise<CreateKeyResponse> {
  return fetchWithAuth<CreateKeyResponse>(
    `/api/v1/api-keys/create?plan_type=${encodeURIComponent(planType)}`,
    { method: "POST" }
  );
}

export async function listApiKeys(): Promise<ApiKeyInfo[]> {
  const r = await fetchWithAuth<ApiKeyInfo[]>(`/api/v1/api-keys/list`);
  return Array.isArray(r) ? r : [];
}

export async function revokeApiKey(keyId: number): Promise<{ status: string; id: number }> {
  return fetchWithAuth(`/api/v1/api-keys/${keyId}/revoke`, { method: "POST" });
}

export async function getApiKeyAnalytics(days = 7): Promise<{
  period_days: number;
  by_key: Array<{
    api_key_id: number;
    key_prefix: string;
    plan_type: string;
    request_count: number;
    usage_today: number;
  }>;
  by_endpoint: Array<{ endpoint: string; request_count: number }>;
}> {
  return fetchWithAuth(
    `/api/v1/api-keys/analytics?days=${days}`
  );
}

export type WebhookInfo = {
  id: number;
  url: string;
  event_type: string;
  created_at: string;
};

export async function listWebhooks(): Promise<WebhookInfo[]> {
  const r = await fetchWithAuth<WebhookInfo[]>(`/api/v1/webhooks/list`);
  return Array.isArray(r) ? r : [];
}

export async function createWebhook(url: string, eventType: string): Promise<WebhookInfo & { created_at: string }> {
  return fetchWithAuth(`/api/v1/webhooks/create`, {
    method: "POST",
    body: JSON.stringify({ url, event_type: eventType }),
  });
}

export async function deleteWebhook(webhookId: number): Promise<{ status: string; id: number }> {
  return fetchWithAuth(`/api/v1/webhooks/${webhookId}`, { method: "DELETE" });
}
