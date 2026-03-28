import "server-only";

import type {
  NarrativeIntelligenceDetail,
  NarrativeIntelligenceListResponse,
} from "./types";
import {
  resolveNarrativeDetail,
  resolveNarrativesIntelligence,
} from "./narratives/resolve-narratives-api";

/**
 * SSR: runs the same resolver as `/api/v1/narratives/intelligence` (Python + trending fallback)
 * by calling Python directly — avoids self-fetch to Next (Vercel / localhost issues).
 */
export async function getNarrativesIntelligenceForServer(params?: {
  limit?: number;
}): Promise<NarrativeIntelligenceListResponse> {
  const { payload } = await resolveNarrativesIntelligence(params?.limit ?? 50);
  return payload;
}

export async function getNarrativeDetailForServer(params: {
  slug: string;
  opportunityLimit?: number;
}): Promise<NarrativeIntelligenceDetail> {
  const { payload } = await resolveNarrativeDetail(
    params.slug,
    params.opportunityLimit ?? 100,
  );
  if (!payload) {
    throw new Error("Narrative not found");
  }
  return payload;
}
