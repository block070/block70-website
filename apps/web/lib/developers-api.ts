import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

/**
 * Browser calls Next.js proxy (same origin) to avoid CORS / mixed-content when
 * NEXT_PUBLIC_API_BASE_URL points at a different host than the web app.
 */
function apiKeysUrl(pathAndQuery: string): string {
  const p = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  if (typeof window !== "undefined") {
    return `/api/api-keys${p}`;
  }
  return `${API_BASE_URL}/api/v1/api-keys${p}`;
}

function webhooksUrl(pathAndQuery: string): string {
  const p = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  if (typeof window !== "undefined") {
    return `/api/webhooks${p}`;
  }
  return `${API_BASE_URL}/api/v1/webhooks${p}`;
}

async function fetchWithAuth<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
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

export type ApiKeyScopes = {
  read: boolean;
  write: boolean;
  trading: boolean;
};

export type ApiKeyInfo = {
  id: number;
  key_prefix: string;
  key_label: string | null;
  plan_type: string;
  rate_limit: number;
  scopes: ApiKeyScopes;
  ip_allowlist: string[];
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
  key_label: string | null;
  scopes: ApiKeyScopes;
  ip_allowlist: string[];
  created_at: string;
  message: string;
};

export type CreateKeyBody = {
  plan_type?: string;
  label?: string | null;
  scopes?: ApiKeyScopes;
  ip_allowlist?: string[] | null;
};

export async function createApiKey(body: CreateKeyBody = {}): Promise<CreateKeyResponse> {
  return fetchWithAuth<CreateKeyResponse>(apiKeysUrl("/create"), {
    method: "POST",
    body: JSON.stringify({
      plan_type: body.plan_type ?? "free",
      label: body.label ?? null,
      scopes: body.scopes
        ? {
            read: body.scopes.read,
            write: body.scopes.write,
            trading: body.scopes.trading,
          }
        : undefined,
      ip_allowlist: body.ip_allowlist ?? undefined,
    }),
  });
}

export async function listApiKeys(): Promise<ApiKeyInfo[]> {
  const r = await fetchWithAuth<ApiKeyInfo[]>(apiKeysUrl("/list"));
  return Array.isArray(r) ? r : [];
}

export async function updateApiKey(
  keyId: number,
  patch: {
    label?: string | null;
    scopes?: ApiKeyScopes;
    ip_allowlist?: string[] | null;
    rate_limit?: number | null;
  }
): Promise<ApiKeyInfo> {
  return fetchWithAuth<ApiKeyInfo>(apiKeysUrl(`/${keyId}`), {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function revokeApiKey(keyId: number): Promise<{ status: string; id: number }> {
  return fetchWithAuth(apiKeysUrl(`/${keyId}/revoke`), { method: "POST" });
}

export type ApiKeyAnalytics = {
  period_days: number;
  total_requests: number;
  total_errors: number;
  by_key: Array<{
    api_key_id: number;
    key_prefix: string;
    key_label: string | null;
    plan_type: string;
    request_count: number;
    error_count: number;
    usage_today: number;
  }>;
  by_endpoint: Array<{ endpoint: string; request_count: number }>;
  errors_by_endpoint: Array<{ endpoint: string; request_count: number }>;
  by_day: Array<{ date: string; requests: number; errors: number }>;
};

export async function getApiKeyAnalytics(days = 7): Promise<ApiKeyAnalytics> {
  return fetchWithAuth(apiKeysUrl(`/analytics?days=${days}`));
}

export type WebhookInfo = {
  id: number;
  url: string;
  event_type: string;
  created_at: string;
};

export async function listWebhooks(): Promise<WebhookInfo[]> {
  const r = await fetchWithAuth<WebhookInfo[]>(webhooksUrl("/list"));
  return Array.isArray(r) ? r : [];
}

export async function createWebhook(
  url: string,
  eventType: string
): Promise<WebhookInfo & { created_at: string }> {
  return fetchWithAuth(webhooksUrl("/create"), {
    method: "POST",
    body: JSON.stringify({ url, event_type: eventType }),
  });
}

export async function deleteWebhook(webhookId: number): Promise<{ status: string; id: number }> {
  return fetchWithAuth(webhooksUrl(`/${webhookId}`), { method: "DELETE" });
}
