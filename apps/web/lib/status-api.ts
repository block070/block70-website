/**
 * Status API - uses same-origin /api/status proxy to avoid CORS and mixed-content issues.
 * The Next.js API route forwards to the backend (API_SERVER_URL).
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

export async function getStatus(): Promise<StatusResponse> {
  const res = await fetch("/api/status", { cache: "no-store" });
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
