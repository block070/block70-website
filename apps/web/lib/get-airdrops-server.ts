import "server-only";

import { fetchAirdropsUpstream } from "@/lib/airdrops-upstream";

import type { Opportunity } from "./types";

/**
 * SSR: load airdrops via FastAPI (see fetchAirdropsUpstream). Does not loop back to this Next
 * server's /api/v1/airdrops during render (avoids deadlock and extra latency).
 */
export async function getAirdropsForServer(): Promise<Opportunity[]> {
  return fetchAirdropsUpstream(200);
}
