import "server-only";

import type { CapitalFlowSummaryDto } from "@/lib/api";
import { backendGet, getBackendApiBase } from "@/lib/narratives/resolve-narratives-api";
import { isPaidBlock70Plan } from "@/lib/plan-tier";

/** SSR: same backend origin + TLS behavior as `/api/health/services` and `/api/flows/summary`. */
export async function getCapitalFlowSummaryForPage(params?: {
  hours?: number;
  chain?: string | null;
  subscriberPlan?: string | null;
}): Promise<CapitalFlowSummaryDto> {
  const base = getBackendApiBase().replace(/\/$/, "");
  if (!base) {
    throw new Error("no_api_base");
  }
  const search = new URLSearchParams();
  if (params?.hours != null) search.set("hours", String(params.hours));
  if (params?.chain) search.set("chain", params.chain);
  const query = search.toString();
  const url = `${base}/api/v1/flows/summary${query ? `?${query}` : ""}`;
  const headers: Record<string, string> = {};
  if (params?.subscriberPlan != null && isPaidBlock70Plan(params.subscriberPlan)) {
    headers["X-Block70-Plan"] = params.subscriberPlan;
  }
  const r = await backendGet(url, headers);
  const body = await r.text();
  if (!r.ok) {
    throw new Error(`flows summary HTTP ${r.status}`);
  }
  return JSON.parse(body) as CapitalFlowSummaryDto;
}
