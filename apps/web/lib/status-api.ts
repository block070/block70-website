/**
 * Status API - fetches directly from the backend when NEXT_PUBLIC_API_BASE_URL is set
 * (bypasses Next.js proxy to avoid Docker networking issues). Falls back to /api/status proxy.
 */
export type JobStatus = {
  id: string;
  label: string;
  next_run: string | null;
  last_run_at: string | null;
  last_status: "success" | "error" | null;
  last_error: string | null;
};

export type StatusResponse = {
  scheduler_running: boolean;
  jobs: JobStatus[];
  error?: string;
};

const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "")
    : "";

export async function getStatus(): Promise<StatusResponse> {
  // Direct fetch from API when URL is set (browser only) - avoids server-side Docker networking
  const url = API_BASE ? `${API_BASE}/api/v1/status` : "/api/status";
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as StatusResponse;
  if (!res.ok) throw new Error(data.error || "Status API error: " + res.status);
  return data;
}

export async function triggerNewsScraper(): Promise<{
  status: string;
  message: string;
}> {
  const res = await fetch("/api/status/news/trigger", {
    method: "POST",
    cache: "no-store",
  });
  const data = (await res.json()) as { status: string; message: string };
  if (!res.ok) throw new Error(data.message || "Trigger failed");
  return data;
}

export async function triggerAllCoinsUpdate(): Promise<{
  status: string;
  message: string;
  synced_pages?: number;
  description_stats?: Record<string, number>;
}> {
  const res = await fetch("/api/status/coins/trigger", {
    method: "POST",
    cache: "no-store",
  });
  const data = (await res.json()) as {
    status: string;
    message: string;
    synced_pages?: number;
    description_stats?: Record<string, number>;
  };
  if (!res.ok) throw new Error(data.message || "Trigger failed");
  return data;
}
