import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") ?? "8", 10) || 8,
    20,
  );

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const lower = q.toLowerCase();
  const results: { id: string; category: string; title: string; subtitle?: string; href: string }[] = [];

  const coins = ["BTC", "ETH", "SOL", "AVAX", "DOGE", "LINK", "UNI", "ATOM"];
  coins
    .filter((c) => c.toLowerCase().includes(lower))
    .slice(0, 3)
    .forEach((c) => {
      results.push({
        id: c,
        category: "coins",
        title: c,
        subtitle: "Coin",
        href: `/coins/${c.toLowerCase()}`,
      });
    });

  if (lower.includes("signal") || lower === "sig") {
    results.push({
      id: "signals",
      category: "signals",
      title: "Signals feed",
      href: "/signals",
    });
  }
  if (lower.includes("airdrop")) {
    results.push({
      id: "airdrops",
      category: "airdrops",
      title: "Airdrops",
      href: "/airdrops",
    });
  }
  if (lower.includes("wallet") || lower.includes("whale")) {
    results.push({
      id: "wallets",
      category: "wallets",
      title: "Smart wallets",
      href: "/wallets",
    });
  }
  if (lower.includes("narrative")) {
    results.push({
      id: "narratives",
      category: "narratives",
      title: "Narratives",
      href: "/narratives",
    });
  }
  if (lower.includes("opportunit")) {
    results.push({
      id: "opportunities",
      category: "signals",
      title: "Opportunities",
      href: "/opportunities",
    });
  }

  return NextResponse.json({
    results: results.slice(0, limit),
  });
}
