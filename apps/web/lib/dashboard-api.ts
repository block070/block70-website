import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

export type LayoutItem = { i: string; x: number; y: number; w: number; h: number };

export type DashboardLayoutResponse = { layout: LayoutItem[] };
export type DashboardWidgetDto = {
  id: number;
  widget_name: string;
  widget_type: string;
  description: string | null;
  default_position: LayoutItem | null;
  created_at: string;
};

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
  if (!res.ok) throw new Error(`Dashboard API error: ${res.status}`);
  return (await res.json()) as T;
}

export async function getDashboardLayout(): Promise<DashboardLayoutResponse> {
  return fetchWithAuth<DashboardLayoutResponse>("/api/v1/dashboard/layout");
}

export async function saveDashboardLayout(
  layout: LayoutItem[],
): Promise<DashboardLayoutResponse> {
  return fetchWithAuth<DashboardLayoutResponse>("/api/v1/dashboard/layout", {
    method: "POST",
    body: JSON.stringify({ layout }),
  });
}

export async function resetDashboardLayout(
  template?: string,
): Promise<DashboardLayoutResponse> {
  const q = template ? `?template=${encodeURIComponent(template)}` : "";
  return fetchWithAuth<DashboardLayoutResponse>(
    `/api/v1/dashboard/layout/reset${q}`,
    { method: "POST" },
  );
}

export async function getDashboardWidgets(): Promise<DashboardWidgetDto[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/widgets`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load widgets");
  return (await res.json()) as DashboardWidgetDto[];
}

export async function getDashboardTemplates(): Promise<{ templates: string[] }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/templates`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load templates");
  return (await res.json()) as { templates: string[] };
}
