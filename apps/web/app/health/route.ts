import { NextResponse } from "next/server";

/**
 * Health check for api.block70.com when it's served by Next.js.
 * Returns 200 so load balancers and monitoring see a healthy service.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
