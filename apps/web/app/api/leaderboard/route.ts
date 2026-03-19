import { NextResponse } from "next/server";
import { smartMoneyWallets } from "@/data/smartMoneyWallets";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chain = searchParams.get("chain");
  const minScore = Number(searchParams.get("min_score") ?? "0");

  const items = smartMoneyWallets
    .filter((w) => (chain ? w.chain === chain : true))
    .filter((w) => w.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ items, total: items.length });
}

