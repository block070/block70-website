import { NextRequest, NextResponse } from "next/server";

export function fastApiOrigin(): string {
  return (process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
    /\/$/,
    "",
  );
}

/**
 * Server-side GET proxy to FastAPI. Forwards Authorization for plan-based feeds.
 * `absolutePath` must include `/api/v1/...` and optional `?query`.
 */
export async function proxyFastApiGet(
  req: NextRequest,
  absolutePath: string,
): Promise<NextResponse> {
  const base = fastApiOrigin();
  if (!base) {
    return NextResponse.json([]);
  }

  const path = absolutePath.startsWith("/") ? absolutePath : `/${absolutePath}`;
  const url = `${base}${path}`;
  const auth = req.headers.get("authorization");

  try {
    const upstream = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
      headers: {
        Accept: "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      },
    });
  } catch {
    return NextResponse.json({ detail: "Upstream unavailable" }, { status: 502 });
  }
}
