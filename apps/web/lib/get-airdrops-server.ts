import "server-only";

import { headers } from "next/headers";

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

/**
 * SSR: resolve `/api/v1/airdrops` against the current request host (correct port in dev)
 * when API_SERVER_URL is unset. Uses `revalidate: 0` (not `cache: "no-store"`) to avoid
 * Next static prerender throwing "Dynamic server usage: no-store fetch".
 */
export async function getAirdropsForServer(): Promise<Opportunity[]> {
  const path = "/api/v1/airdrops";
  const envBase =
    process.env.API_SERVER_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    "";

  let url: string;
  if (envBase) {
    url = `${envBase}${path}`;
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
  }

  const res = await fetch(url, {
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`API request failed with status ${res.status}`);
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch (e) {
    throw e;
  }

  const data = normalizeOpportunityList(raw);
  if (!data) {
    throw new Error(
      `airdrops: expected array or { items|data|results: [] }, got ${typeof raw}`,
    );
  }

  return data;
}
