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
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type UserNotificationDto = {
  id: number;
  notification_type: string;
  content: string;
  created_at: string | null;
  read_at: string | null;
};

export async function listNotifications(
  limit = 50,
  offset = 0,
): Promise<UserNotificationDto[]> {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return fetchWithAuth<UserNotificationDto[]>(`/api/v1/notifications?${q}`);
}

export async function markNotificationRead(id: number): Promise<{ ok: boolean }> {
  return fetchWithAuth<{ ok: boolean }>(`/api/v1/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export type NotificationPrefs = {
  email_digest: boolean;
  email_realtime: boolean;
  email_marketing: boolean;
  push_enabled: boolean;
  notify_opportunity: boolean;
  notify_whale: boolean;
  notify_narrative: boolean;
  notify_signal: boolean;
  notify_trial: boolean;
  notify_reengage: boolean;
};

export async function getNotificationPreferences(): Promise<NotificationPrefs> {
  return fetchWithAuth<NotificationPrefs>("/api/v1/notification-preferences");
}

export async function patchNotificationPreferences(
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  return fetchWithAuth<NotificationPrefs>("/api/v1/notification-preferences", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function pingActivity(): Promise<{ ok: boolean }> {
  return fetchWithAuth<{ ok: boolean }>("/api/v1/me/ping", { method: "POST", body: "{}" });
}
