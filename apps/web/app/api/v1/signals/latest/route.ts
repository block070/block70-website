import { NextRequest } from "next/server";

import { proxyFastApiGet } from "@/lib/proxy-fastapi-get";

export const dynamic = "force-dynamic";

/** Proxies GET /api/v1/signals/latest — same-origin for the browser (avoids CORS / mixed content). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.toString();
  return proxyFastApiGet(req, `/api/v1/signals/latest${q ? `?${q}` : ""}`);
}
