import { NextResponse, type NextRequest } from "next/server";
import { hasUplandFeature, redactForTier, resolveUplandContext } from "@/lib/upland/entitlements";
import { getPropertyById } from "@/lib/upland/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await resolveUplandContext(request);
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  const includeBreakdown =
    request.nextUrl.searchParams.get("include")?.includes("breakdown") &&
    hasUplandFeature(ctx.tier, "upland_deal_score");

  const property = await getPropertyById(id, { includeBreakdown: Boolean(includeBreakdown) });
  if (!property) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(redactForTier(property, ctx.tier));
}
