import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const id = req.nextUrl.searchParams.get("id");
  const opportunityLimit =
    req.nextUrl.searchParams.get("opportunity_limit") ?? "100";

  if (!API_BASE) {
    return NextResponse.json({ detail: "Narrative not found" }, { status: 404 });
  }

  const base = API_BASE.replace(/\/$/, "");
  const q = new URLSearchParams();
  if (slug) q.set("slug", slug);
  if (id) q.set("id", id);
  q.set("opportunity_limit", opportunityLimit);

  try {
    const upstream = await fetch(
      `${base}/api/v1/narratives/detail?${q.toString()}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    );
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ detail: "Narrative not found" }, { status: 404 });
  }
}
