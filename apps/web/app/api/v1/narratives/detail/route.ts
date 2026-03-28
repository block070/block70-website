import { NextRequest, NextResponse } from "next/server";

import type { NarrativeDetailMeta } from "@/lib/narratives/resolve-narratives-api";
import { resolveNarrativeDetail } from "@/lib/narratives/resolve-narratives-api";

export const dynamic = "force-dynamic";

function narrDetailLog(event: string, data: Record<string, unknown>) {
  console.log(`[narratives/detail] ${event}`, JSON.stringify(data));
}

function metaToHeaders(meta: NarrativeDetailMeta): Record<string, string> {
  return {
    "X-Narratives-Detail-Source": meta.source,
    "Cache-Control": "no-store",
  };
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const id = req.nextUrl.searchParams.get("id");
  const opportunityLimit =
    req.nextUrl.searchParams.get("opportunity_limit") ?? "100";
  const oppLimit = Math.min(200, Math.max(1, Number(opportunityLimit) || 100));

  if (id) {
    const q = new URLSearchParams();
    if (slug) q.set("slug", slug);
    q.set("id", id);
    q.set("opportunity_limit", String(oppLimit));
    const base = (
      process.env.API_SERVER_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      ""
    ).replace(/\/$/, "");
    if (base) {
      try {
        const upstream = await fetch(
          `${base}/api/v1/narratives/detail?${q.toString()}`,
          {
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(25_000),
          },
        );
        if (upstream.ok) {
          const data = await upstream.json().catch(() => ({}));
          narrDetailLog("branch", { source: "upstream-by-id" });
          return NextResponse.json(data, {
            status: upstream.status,
            headers: {
              "X-Narratives-Detail-Source": "upstream",
              "Cache-Control": "no-store",
            },
          });
        }
      } catch {
        /* fall through to resolve by slug only */
      }
    }
  }

  if (!slug?.trim()) {
    narrDetailLog("branch", { source: "not-found", reason: "no-slug" });
    return NextResponse.json(
      { detail: "Narrative not found" },
      { status: 404, headers: metaToHeaders({ source: "not-found" }) },
    );
  }

  const { payload, meta } = await resolveNarrativeDetail(slug, oppLimit);
  narrDetailLog("branch", { ...meta, slug: slug.slice(0, 80) });

  if (!payload) {
    return NextResponse.json(
      { detail: "Narrative not found" },
      { status: 404, headers: metaToHeaders(meta) },
    );
  }

  return NextResponse.json(payload, { headers: metaToHeaders(meta) });
}
