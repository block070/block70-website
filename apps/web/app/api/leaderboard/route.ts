import { NextResponse } from "next/server";
import { smartMoneyWallets } from "@/data/smartMoneyWallets";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chain = searchParams.get("chain");
  const minScore = Number(searchParams.get("min_score") ?? "0");
  const cookie = request.headers.get("cookie") ?? "";
  const planMatch = cookie.match(/(?:^|;\s*)block70_plan=([^;]+)/);
  const plan = planMatch ? decodeURIComponent(planMatch[1]) : "free";
  const isPro = plan === "pro" || plan === "admin";

  const filtered = smartMoneyWallets
    .filter((w) => (chain ? w.chain === chain : true))
    .filter((w) => w.score >= minScore)
    .sort((a, b) => b.score - a.score);
  const items = isPro ? filtered : filtered.slice(0, 5);

  return NextResponse.json({ items, total: items.length, locked: !isPro, plan });
}

