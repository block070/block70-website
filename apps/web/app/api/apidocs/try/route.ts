import { NextRequest, NextResponse } from "next/server";

import { buildDevPath, buildQueryString, getEndpointById } from "@/lib/apidocs/catalog";

export const dynamic = "force-dynamic";

const MAX_URL_LEN = 2048;

function getApiBase(): string {
  return (
    process.env.API_SERVER_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).replace(/\/$/, "");
}

/**
 * Try-it: server-side GET to developer API only for catalogued endpoints.
 * POST body: { endpointId, apiKey, pathParams?, query? }
 * API key is forwarded to Block70 API and not persisted.
 */
export async function POST(req: NextRequest) {
  const base = getApiBase();
  if (!base) {
    return NextResponse.json(
      { ok: false, error: "API backend URL is not configured." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const endpointId = (body as { endpointId?: unknown }).endpointId;
  const apiKey = (body as { apiKey?: unknown }).apiKey;
  const pathParams =
    (body as { pathParams?: Record<string, string> }).pathParams ?? {};
  const query = (body as { query?: Record<string, string> }).query ?? {};

  if (typeof endpointId !== "string" || !getEndpointById(endpointId)) {
    return NextResponse.json({ ok: false, error: "Unknown or invalid endpoint" }, { status: 400 });
  }

  if (typeof apiKey !== "string" || !apiKey.trim().startsWith("bk70_")) {
    return NextResponse.json(
      { ok: false, error: "Provide a valid Block70 API key (bk70_…)" },
      { status: 400 }
    );
  }

  const ep = getEndpointById(endpointId)!;
  if (ep.method !== "GET") {
    return NextResponse.json({ ok: false, error: "Only GET is supported" }, { status: 400 });
  }

  const allowedQuery = new Set((ep.queryParams ?? []).map((q) => q.name));
  const safeQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (!allowedQuery.has(k)) continue;
    if (v === "" || v === undefined) continue;
    safeQuery[k] = String(v);
  }

  const path = buildDevPath(ep, pathParams);
  if (path.includes("{")) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid path parameters" },
      { status: 400 }
    );
  }

  const qs = buildQueryString(safeQuery);
  const url = `${base}${path}${qs}`;
  if (url.length > MAX_URL_LEN) {
    return NextResponse.json({ ok: false, error: "URL too long" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Key": apiKey.trim(),
      },
      cache: "no-store",
    });

    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _raw: text.slice(0, 8000) };
    }

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      path,
      query: safeQuery,
      data: json,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Request failed",
        status: 502,
      },
      { status: 502 }
    );
  }
}
