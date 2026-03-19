import { NextResponse } from "next/server";
import { smartMoneyWallets } from "@/data/smartMoneyWallets";

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const planMatch = cookie.match(/(?:^|;\s*)block70_plan=([^;]+)/);
  const plan = planMatch ? decodeURIComponent(planMatch[1]) : "free";
  const isPro = plan === "pro" || plan === "admin";
  const items = isPro ? smartMoneyWallets : smartMoneyWallets.slice(0, 5);
  return NextResponse.json({
    items,
    total: items.length,
    locked: !isPro,
    plan,
  });
}

