import { fetchJson } from "./api";

export async function getRecentEvents(
  limit = 40,
): Promise<
  {
    id: number;
    event_type: string;
    source: string;
    token_symbol: string | null;
    chain: string | null;
    payload: any;
    created_at: string;
  }[]
> {
  const search = new URLSearchParams({ limit: String(limit) });
  return fetchJson(`/api/v1/events/recent?${search.toString()}`);
}

export async function getEventStats(
  hours = 6,
): Promise<{
  window_hours: number;
  since: string;
  until: string;
  total_events: number;
  by_type: Record<string, number>;
  by_source: Record<string, number>;
}> {
  const search = new URLSearchParams({ hours: String(hours) });
  return fetchJson(`/api/v1/events/stats?${search.toString()}`);
}

