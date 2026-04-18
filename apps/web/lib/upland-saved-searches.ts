// Client helpers for the Upland saved-searches CRUD surface (Pro+).
// Thin wrappers around FastAPI routes so the UI components stay readable.

import { getToken } from "./auth";

export type SavedSearch = {
  id: number;
  name: string;
  filters: Record<string, unknown>;
  alert_channel: "none" | "email";
  created_at: string;
  updated_at: string;
};

async function authed<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(
      typeof msg?.detail === "string" ? msg.detail : `HTTP ${res.status}`,
    );
  }
  return (await res.json()) as T;
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  return authed<SavedSearch[]>("/api/v1/upland/saved-searches");
}

export async function createSavedSearch(
  payload: Pick<SavedSearch, "name" | "filters" | "alert_channel">,
): Promise<SavedSearch> {
  return authed<SavedSearch>("/api/v1/upland/saved-searches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteSavedSearch(id: number): Promise<void> {
  await authed<void>(`/api/v1/upland/saved-searches/${id}`, {
    method: "DELETE",
  });
}
