import { NextResponse, type NextRequest } from "next/server";
import { uplandPrisma } from "@/lib/upland/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const runs = await uplandPrisma.ingestionRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });
  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id,
      source: r.source,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      propertiesSeen: r.propertiesSeen,
      propertiesUpserted: r.propertiesUpserted,
      error: r.error,
    })),
  });
}
