// POST /api/upland/ingest/trigger
//
// Protected by UPLAND_INGEST_SECRET (header `X-Upland-Ingest-Secret`).
// Intended caller is the n8n workflow. Human operators should prefer running
// scripts/upland/run-ingest.ts from the CLI so they don't need the secret.

import { NextResponse, type NextRequest } from "next/server";
import { runIngestion } from "@/lib/upland/ingestion";
import type { SourceName } from "@/lib/upland/ingestion/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const source = typeof body?.source === "string" ? (body.source as SourceName) : undefined;
  const maxPages = typeof body?.maxPages === "number" ? Number(body.maxPages) : undefined;

  const summary = await runIngestion({ source, maxPages });
  const status = summary.status === "error" ? 500 : 200;
  return NextResponse.json(summary, { status });
}
