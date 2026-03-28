import { NextRequest, NextResponse } from "next/server";

import type { NarrativesIntelligenceMeta } from "@/lib/narratives/resolve-narratives-api";
import { resolveNarrativesIntelligence } from "@/lib/narratives/resolve-narratives-api";

export const dynamic = "force-dynamic";

function narrProxyLog(event: string, data: Record<string, unknown>) {
  console.log(`[narratives/intelligence] ${event}`, JSON.stringify(data));
}

function metaToResponseHeaders(meta: NarrativesIntelligenceMeta): Record<string, string> {
  const h: Record<string, string> = {
    "X-Narratives-Source": meta.source,
    "Cache-Control": "no-store",
  };
  if (meta.intelStatus !== undefined) {
    h["X-Narratives-Intel-Status"] = String(meta.intelStatus);
  }
  if (meta.trendingStatus !== undefined) {
    h["X-Narratives-Trending-Status"] = String(meta.trendingStatus);
  }
  if (meta.oppsLen !== undefined) {
    h["X-Narratives-Trending-Count"] = String(meta.oppsLen);
  }
  if (meta.syntheticLen !== undefined) {
    h["X-Narratives-Count"] = String(meta.syntheticLen);
  } else if (meta.intelCount !== undefined && meta.intelCount >= 0) {
    h["X-Narratives-Count"] = String(meta.intelCount);
  }
  if (meta.narrativeOppsSource !== undefined) {
    h["X-Narratives-Opps-Source"] = meta.narrativeOppsSource;
  }
  if (meta.opportunitiesListStatus !== undefined) {
    h["X-Narratives-Opportunities-List-Status"] = String(
      meta.opportunitiesListStatus,
    );
  }
  if (meta.resolveDbg) {
    const encoded = encodeURIComponent(JSON.stringify(meta.resolveDbg));
    if (encoded.length <= 3800) {
      h["X-Narratives-DBG"] = encoded;
    }
  }
  return h;
}

export async function GET(request: NextRequest) {
  const limitRaw = request.nextUrl.searchParams.get("limit") ?? "50";
  const limit = Math.min(200, Math.max(1, Number(limitRaw) || 50));

  const { payload, meta } = await resolveNarrativesIntelligence(limit);
  narrProxyLog("branch", { ...meta, limit });

  return NextResponse.json(payload, {
    headers: metaToResponseHeaders(meta),
  });
}
