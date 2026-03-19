import { NextResponse } from "next/server";
import { getLiveSmartMoneyWallets, getLiveSmartMoneyWalletsWithLimit } from "@/lib/smart-money-live";

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const planMatch = cookie.match(/(?:^|;\s*)block70_plan=([^;]+)/);
  const plan = planMatch ? decodeURIComponent(planMatch[1]) : "free";
  const isPro = plan === "pro" || plan === "admin";
  const items = isPro
    ? (await getLiveSmartMoneyWallets()).slice().sort((a, b) => b.score - a.score)
    : await getLiveSmartMoneyWalletsWithLimit(5);
  return NextResponse.json({
    items,
    total: items.length,
    locked: !isPro,
    plan,
  });
}

