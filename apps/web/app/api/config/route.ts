import { NextResponse } from "next/server";

/** Returns the API base URL for the browser (used by status page). Use public URL only. */
export async function GET() {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  return NextResponse.json({ apiBase });
}
