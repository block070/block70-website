import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
const COINGECKO_MARKETS =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&sparkline=false&price_change_percentage=24h";

type CoinPayload = {
  name: string;
  symbol: string;
  slug: string;
  price: number;
  change_24h: number | null;
};

async function fetchFromCoinGecko(limit: number): Promise<CoinPayload[]> {
  const res = await fetch(COINGECKO_MARKETS, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{
    id?: string;
    name?: string;
    symbol?: string;
    current_price?: number;
    price_change_percentage_24h?: number | null;
  }>;
  if (!Array.isArray(data)) return [];
  return data.slice(0, limit).map((c) => ({
    name: c.name || "Unknown",
    symbol: (c.symbol || "").toUpperCase(),
    slug: c.id || "",
    price: c.current_price ?? 0,
    change_24h: c.price_change_percentage_24h ?? null,
  }));
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ chainName: string }> | { chainName: string } }
) {
  const params = await Promise.resolve(context.params);
  const chainName = params.chainName;
  const limit = Math.min(
    20,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 5)
  );

  if (!chainName || typeof chainName !== "string") {
    return NextResponse.json([], { status: 400 });
  }

  if (API_BASE) {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/chains/${encodeURIComponent(chainName)}/coins?limit=${limit}`,
        { cache: "no-store", headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return NextResponse.json(data);
        }
      }
    } catch {
      // fall through
    }
  }

  const coins = await fetchFromCoinGecko(limit);
  return NextResponse.json(coins);
}
