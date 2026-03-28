import "server-only";

import { appendFileSync } from "node:fs";
import { join } from "node:path";

import { backendGet, getBackendApiBase } from "@/lib/narratives/resolve-narratives-api";

import type { Opportunity } from "./types";

function normalizeOpportunityList(raw: unknown): Opportunity[] | null {
  if (Array.isArray(raw)) return raw as Opportunity[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as Opportunity[];
    if (Array.isArray(o.data)) return o.data as Opportunity[];
    if (Array.isArray(o.results)) return o.results as Opportunity[];
  }
  return null;
}

/** Best-effort monorepo / Next cwd: try a few parents for shared debug log. */
function appendDebugNdjson(payload: Record<string, unknown>) {
  const line = `${JSON.stringify({
    sessionId: "9aa1f6",
    timestamp: Date.now(),
    hypothesisId: "H-airdrops2",
    ...payload,
  })}\n`;
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    try {
      appendFileSync(join(dir, "debug-9aa1f6.log"), line);
      break;
    } catch {
      /* try parent */
    }
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  fetch("http://127.0.0.1:7428/ingest/b2bee36a-3f9b-42a9-b6fb-0dc54bacc543", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "9aa1f6",
    },
    body: JSON.stringify({ sessionId: "9aa1f6", ...payload, timestamp: Date.now(), hypothesisId: "H-airdrops2" }),
  }).catch(() => {});
}

/**
 * Fetch airdrop opportunities from FastAPI (same base + TLS fallback as narratives).
 * Never throws: returns [] on missing base, network error, non-OK status, or unexpected JSON shape.
 * Avoids SSR loopback to this Next app (deadlock / timeout risk).
 */
export async function fetchAirdropsUpstream(limit: number): Promise<Opportunity[]> {
  const cap = Math.min(500, Math.max(1, limit));
  const base = getBackendApiBase().replace(/\/$/, "");

  if (!base) {
    appendDebugNdjson({
      location: "airdrops-upstream.ts:fetchAirdropsUpstream",
      message: "no backend base — returning empty",
      data: { hasApiServerUrl: Boolean(process.env.API_SERVER_URL) },
    });
    return [];
  }

  const url = `${base}/api/v1/airdrops?limit=${encodeURIComponent(String(cap))}`;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* ignore */
  }

  let r: Awaited<ReturnType<typeof backendGet>>;
  try {
    r = await backendGet(url);
  } catch (err) {
    appendDebugNdjson({
      location: "airdrops-upstream.ts:fetchAirdropsUpstream",
      message: "backendGet threw",
      data: {
        host,
        err: err instanceof Error ? err.message : String(err).slice(0, 300),
      },
    });
    return [];
  }

  if (!r.ok) {
    const body = (await r.text().catch(() => "")).slice(0, 500);
    appendDebugNdjson({
      location: "airdrops-upstream.ts:fetchAirdropsUpstream",
      message: "upstream not ok",
      data: { status: r.status, host, body },
    });
    return [];
  }

  let raw: unknown;
  try {
    raw = await r.json();
  } catch (err) {
    appendDebugNdjson({
      location: "airdrops-upstream.ts:fetchAirdropsUpstream",
      message: "json parse failed",
      data: {
        host,
        err: err instanceof Error ? err.message : String(err),
      },
    });
    return [];
  }

  const data = normalizeOpportunityList(raw);
  if (!data) {
    appendDebugNdjson({
      location: "airdrops-upstream.ts:fetchAirdropsUpstream",
      message: "normalize failed",
      data: {
        host,
        rawType: typeof raw,
        preview: JSON.stringify(raw).slice(0, 400),
      },
    });
    return [];
  }

  appendDebugNdjson({
    location: "airdrops-upstream.ts:fetchAirdropsUpstream",
    message: "ok",
    data: { host, count: data.length },
  });

  return data;
}
