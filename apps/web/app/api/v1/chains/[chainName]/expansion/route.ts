import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
const DEFILLAMA_PROTOCOLS = "https://api.llama.fi/v2/protocols";

type ProtocolPayload = {
  name: string;
  tvl: number;
  category: string;
};

async function fetchProtocolsForChain(
  chainName: string,
  limit: number
): Promise<ProtocolPayload[]> {
  const res = await fetch(DEFILLAMA_PROTOCOLS, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{
    name?: string;
    category?: string;
    chainTvls?: Record<string, number>;
  }>;
  if (!Array.isArray(data)) return [];

  const normalized = chainName.trim();
  const aliases: string[] = [normalized, chainName];
  if (normalized === "Optimism") aliases.push("OP Mainnet");
  if (normalized === "OP Mainnet") aliases.push("Optimism");
  if (normalized === "BSC") aliases.push("Binance");
  if (normalized === "Polygon") aliases.push("Polygon POS");

  const withTvl = data
    .filter((p) => {
      const tvls = p.chainTvls;
      if (!tvls || typeof tvls !== "object") return false;
      const chainTvl = aliases.reduce<number | undefined>(
        (v, a) => v ?? (tvls[a] as number | undefined),
        undefined
      );
      return typeof chainTvl === "number" && chainTvl > 0;
    })
    .map((p) => {
      const tvl =
        aliases.reduce<number | undefined>(
          (v, a) => v ?? (p.chainTvls?.[a] as number | undefined),
          undefined
        ) ?? 0;
      return {
        name: p.name || "Unknown",
        tvl,
        category: p.category || "DeFi",
      };
    })
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, limit);

  return withTvl;
}

export type ExpansionResponse = {
  protocols: ProtocolPayload[];
  coins: never[];
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ chainName: string }> | { chainName: string } }
) {
  const params = await Promise.resolve(context.params);
  const chainName = params.chainName;
  const limit = Math.min(10, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 5));

  if (!chainName || typeof chainName !== "string") {
    return NextResponse.json({ protocols: [], coins: [] }, { status: 400 });
  }

  if (API_BASE) {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/chains/${encodeURIComponent(chainName)}/expansion?limit=${limit}`,
        { cache: "no-store", headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && (data.protocols?.length ?? 0) > 0) {
          return NextResponse.json(data);
        }
      }
    } catch {
      // fall through
    }
  }

  const protocols = await fetchProtocolsForChain(chainName, limit);

  return NextResponse.json({ protocols, coins: [] });
}
