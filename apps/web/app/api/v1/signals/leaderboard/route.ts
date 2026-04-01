import { NextRequest } from "next/server";

import { proxyFastApiGet } from "@/lib/proxy-fastapi-get";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.toString();
  return proxyFastApiGet(req, `/api/v1/signals/leaderboard${q ? `?${q}` : ""}`);
}
