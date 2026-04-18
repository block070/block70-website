import { NextResponse, type NextRequest } from "next/server";
import { resolveUplandContext } from "@/lib/upland/entitlements";
import { getGlobalStats } from "@/lib/upland/queries";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(request: NextRequest) {
  const ctx = await resolveUplandContext(request);
  try {
    const stats = await getGlobalStats();
    // Free tier: hide hidden-gem counts to avoid teasing gated content.
    if (ctx.tier === "free") {
      return NextResponse.json({
        ...stats,
        hiddenGems: null,
      });
    }
    return NextResponse.json(stats);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: "query_failed", detail: msg }, { status: 500 });
  }
}
