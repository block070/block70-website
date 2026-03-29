import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getBackendApiBase } from "@/lib/narratives/resolve-narratives-api";

export const dynamic = "force-dynamic";

async function forward(req: NextRequest, segments: string[] | undefined) {
  const base = getBackendApiBase().replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { detail: "Backend URL not configured (API_SERVER_URL)." },
      { status: 503 },
    );
  }

  const pathSuffix = segments?.length ? `/${segments.join("/")}` : "";
  const src = new URL(req.url);
  const target = `${base}/api/v1/api-keys${pathSuffix}${src.search}`;

  const cookieToken = cookies().get("block70_session")?.value;
  const authHeader = req.headers.get("authorization");
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (authHeader) headers.Authorization = authHeader;
  else if (cookieToken) headers.Authorization = `Bearer ${cookieToken}`;

  const init: RequestInit = {
    method: req.method,
    headers: { ...headers },
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await req.text();
    if (body) {
      init.body = body;
      init.headers = { ...init.headers, "Content-Type": "application/json" };
    }
  }

  const res = await fetch(target, init);
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
  });
}

type Ctx = { params: Promise<{ slug?: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  return forward(req, slug);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  return forward(req, slug);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  return forward(req, slug);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  return forward(req, slug);
}
