import { NextRequest } from "next/server";

import { proxyFastApiGet } from "@/lib/proxy-fastapi-get";

export const dynamic = "force-dynamic";

/** Proxies GET /api/v1/signals/{token} */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> | { token: string } },
) {
  const { token: raw } = await Promise.resolve(context.params);
  const token = encodeURIComponent(raw ?? "");
  const q = req.nextUrl.searchParams.toString();
  return proxyFastApiGet(req, `/api/v1/signals/${token}${q ? `?${q}` : ""}`);
}
