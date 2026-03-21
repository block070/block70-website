import { API_BASE_URL } from "./api";

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
};

export async function getStatus(): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/status`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Status API error: " + res.status);
  return res.json() as Promise<StatusResponse>;
}

export async function triggerNewsScraper(): Promise<{
  status: string;
  message: string;
}> {
  const res = await fetch(`${API_BASE_URL}/api/v1/status/news/trigger`, {
    method: "POST",
    cache: "no-store",
  });
  const data = (await res.json()) as { status: string; message: string };
  if (!res.ok) throw new Error(data.message || "Trigger failed");
  return data;
}
