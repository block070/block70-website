import "server-only";

import { headers } from "next/headers";

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

function envOrDefaultOrigin(): string {
  const explicit =
    process.env.API_SERVER_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";
  if (explicit) return explicit.replace(/\/$/, "");
  const protocol = process.env.VERCEL ? "https" : "http";
  const host =
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    (typeof process.env.NEXT_PUBLIC_SITE_URL === "string"
      ? process.env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, "")
      : "") ||
    `localhost:${process.env.PORT || "3000"}`;
  return `${protocol}://${host}`;
}

// #region agent log
function airdropsDbg(message: string, data: Record<string, unknown>) {
  const payload = {
    sessionId: "9aa1f6",
    location: "get-airdrops-server.ts",
    message,
    data,
    timestamp: Date.now(),
    hypothesisId: "H-airdrops",
  };
  fetch("http://127.0.0.1:7428/ingest/b2bee36a-3f9b-42a9-b6fb-0dc54bacc543", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "9aa1f6",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
// #endregion

/**
 * SSR: load airdrops from FastAPI using the same backend base + TLS fallback as narratives.
 * When no API base is configured, resolve `/api/v1/airdrops` on the current host (Next proxy).
 */
export async function getAirdropsForServer(): Promise<Opportunity[]> {
  const path = "/api/v1/airdrops?limit=200";
  const backendBase = getBackendApiBase();

  let url: string;
  let mode: "backend" | "next-relative";

  if (backendBase) {
    url = `${backendBase.replace(/\/$/, "")}${path}`;
    mode = "backend";
  } else {
    try {
      const h = await headers();
      const host = h.get("x-forwarded-host") ?? h.get("host");
      if (host) {
        const proto =
          h.get("x-forwarded-proto") ??
          (process.env.VERCEL ? "https" : "http");
        url = `${proto}://${host}${path}`;
      } else {
        url = `${envOrDefaultOrigin()}${path}`;
      }
    } catch {
      url = `${envOrDefaultOrigin()}${path}`;
    }
    mode = "next-relative";
  }

  let raw: unknown;

  if (mode === "backend") {
    const r = await backendGet(url);
    // #region agent log
    airdropsDbg("airdrops backendGet result", {
      mode,
      status: r.status,
      ok: r.ok,
      host: (() => {
        try {
          return new URL(url).hostname;
        } catch {
          return "";
        }
      })(),
    });
    // #endregion
    if (!r.ok) {
      throw new Error(`API request failed with status ${r.status}`);
    }
    raw = await r.json();
  } else {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      next: { revalidate: 0 },
    });
    // #region agent log
    airdropsDbg("airdrops relative fetch result", {
      mode,
      status: res.status,
      ok: res.ok,
    });
    // #endregion
    if (!res.ok) {
      throw new Error(`API request failed with status ${res.status}`);
    }
    try {
      raw = await res.json();
    } catch (e) {
      throw e;
    }
  }

  const data = normalizeOpportunityList(raw);
  if (!data) {
    throw new Error(
      `airdrops: expected array or { items|data|results: [] }, got ${typeof raw}`,
    );
  }

  return data;
}
