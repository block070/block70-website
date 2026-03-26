import { NextResponse } from "next/server";

import { getCryptoHourPool } from "@/lib/server/crypto-hour-pool";
import { runCryptoHourXPostSlot } from "@/lib/server/crypto-hour-x-cron";

export const runtime = "nodejs";

function normalizeSecret(raw: string): string {
  let s = raw.trim();
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s.replace(/\r/g, "");
}

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET ? normalizeSecret(process.env.CRON_SECRET) : "";
  if (!secret) return false;
  const auth = request.headers.get("authorization")?.trim() ?? "";
  return auth === `Bearer ${secret}`;
}

/** Vercel Cron uses GET with Authorization: Bearer CRON_SECRET when CRON_SECRET is set in project env. */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pool = getCryptoHourPool();
  if (!pool) {
    return NextResponse.json(
      { error: "CRYPTO_HOUR_DATABASE_URL / DATABASE_URL not configured for crypto hour DB" },
      { status: 503 },
    );
  }

  const result = await runCryptoHourXPostSlot(pool, new Date());
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
