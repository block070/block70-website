import { NextResponse } from "next/server";
import { smartAlerts } from "@/data/alerts";

export async function GET() {
  return NextResponse.json({
    items: smartAlerts,
    total: smartAlerts.length,
  });
}

