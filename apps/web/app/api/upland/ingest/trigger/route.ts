// POST /api/upland/ingest/trigger
//
// Protected by UPLAND_INGEST_SECRET (header `X-Upland-Ingest-Secret`).
// Intended callers: the n8n workflow and operator-run curl from a trusted box.
//
// Request body (all optional):
//   {
//     "source":      "mock" | "upland-official",
//     "maxPages":    number,       // clamped server-side
//     "propIds":     string[],     // REQUIRED for upland-official unless
//                                  // UPLAND_PROPERTY_IDS env is set
//     "rateLimitMs": number,       // per-request pacing override
//     "strict":      boolean       // fail the whole run on any id error
//   }

import { NextResponse, type NextRequest } from "next/server";
import { runIngestion } from "@/lib/upland/ingestion";
import type { SourceName } from "@/lib/upland/ingestion/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PROP_IDS = 5000; // hard cap so a typo doesn't kick off a 100k-row run

export async function POST(request: NextRequest) {
  const secret = process.env.UPLAND_INGEST_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "not_configured", detail: "UPLAND_INGEST_SECRET is unset" },
      { status: 500 },
    );
  }
  if (request.headers.get("x-upland-ingest-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // empty body is OK
  }

  const source =
    typeof body?.source === "string" ? (body.source as SourceName) : undefined;
  const maxPages =
    typeof body?.maxPages === "number" ? Number(body.maxPages) : undefined;
  const rateLimitMs =
    typeof body?.rateLimitMs === "number" ? Number(body.rateLimitMs) : undefined;
  const strict = typeof body?.strict === "boolean" ? body.strict : undefined;

  const propIds = parsePropIds(body?.propIds);
  if (propIds && propIds.length > MAX_PROP_IDS) {
    return NextResponse.json(
      {
        error: "too_many_prop_ids",
        detail: `propIds capped at ${MAX_PROP_IDS} per trigger; paginate across multiple requests.`,
      },
      { status: 400 },
    );
  }

  const summary = await runIngestion({
    source,
    maxPages,
    propIds,
    rateLimitMs,
    strict,
  });
  const status = summary.status === "error" ? 500 : 200;
  return NextResponse.json(summary, { status });
}

function parsePropIds(v: unknown): string[] | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const arr = v
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.length > 0 ? arr : undefined;
  }
  if (Array.isArray(v)) {
    const arr = v
      .map((x) => (typeof x === "number" ? String(x) : typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
    return arr.length > 0 ? arr : undefined;
  }
  return undefined;
}
