import { NextResponse } from "next/server";
import { smartTokens } from "@/data/tokens";

export async function GET() {
  return NextResponse.json({
    items: smartTokens,
    total: smartTokens.length,
  });
}

