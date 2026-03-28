import { NextRequest, NextResponse } from "next/server";

import { fetchRssDirectFallback } from "@/lib/news/rss-direct-fallback";

export const dynamic = "force-dynamic";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

/**
 * Trending-style news for the web app. Tries backend aggregate when configured;
 * otherwise serves RSS fallback from the server (same-origin for browsers).
 */
export async function GET(req: NextRequest) {
  const rawLimit = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(100, Math.max(1, Number(rawLimit) || 40));

  if (API_BASE) {
    const base = API_BASE.replace(/\/$/, "");
    try {
      const upstream = await fetch(
        `${base}/api/news/trending?limit=${encodeURIComponent(String(limit))}`,
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );
      if (upstream.ok) {
        const data = (await upstream.json()) as unknown;
        if (data && typeof data === "object" && "items" in data) {
          return NextResponse.json(data);
        }
      }
    } catch {
      /* use RSS */
    }
    try {
      const upstream = await fetch(
        `${base}/api/v1/articles?limit=${encodeURIComponent(String(limit))}`,
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );
      if (upstream.ok) {
        const arr = (await upstream.json()) as unknown;
        if (Array.isArray(arr)) {
          return NextResponse.json({ items: arr, total: arr.length });
        }
      }
    } catch {
      /* use RSS */
    }
  }

  try {
    const items = await fetchRssDirectFallback(limit);
    return NextResponse.json({ items, total: items.length });
  } catch {
    return NextResponse.json({ items: [], total: 0 });
  }
}
