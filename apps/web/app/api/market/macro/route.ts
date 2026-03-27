import { NextResponse } from "next/server";
import {
  buildMacroDashboard,
  MACRO_CACHE_SEC,
} from "@/lib/market/build-macro-dashboard";

export async function GET() {
  try {
    const data = await buildMacroDashboard();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": `public, s-maxage=${MACRO_CACHE_SEC}, stale-while-revalidate=${MACRO_CACHE_SEC * 4}`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Macro dashboard build failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
