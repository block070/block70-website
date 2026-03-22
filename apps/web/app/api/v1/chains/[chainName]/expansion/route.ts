import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
const DEFILLAMA_PROTOCOLS = "https://api.llama.fi/v2/protocols";
const COINGECKO_LIST =
  "https://api.coingecko.com/api/v3/coins/list?include_platform=true";
const COINGECKO_MARKETS_BASE =
  "https://api.coingecko.com/api/v3/coins/markets";

// DeFiLlama chain name -> CoinGecko asset_platform_id
const CHAIN_TO_PLATFORM: Record<string, string> = {
  Ethereum: "ethereum",
  Solana: "solana",
  Tron: "tron",
  BSC: "binance-smart-chain",
  Base: "base",
  Arbitrum: "arbitrum-one",
  Polygon: "polygon-pos",
  Avalanche: "avalanche-2",
  "OP Mainnet": "optimistic-ethereum",
  Optimism: "optimistic-ethereum",
  Linea: "linea",
  Scroll: "scroll",
  "ZKsync Era": "zksync",
  Blast: "blast",
  Gnosis: "xdai",
  Mantle: "mantle",
  Starknet: "starknet",
  Sui: "sui",
  Aptos: "aptos",
  Near: "near-protocol",
  Bitcoin: "bitcoin",
  CosmosHub: "cosmos",
  "Terra Classic": "terra",
  Terra2: "terra-2",
  Injective: "injective",
  Sei: "sei-network",
  Thorchain: "thorchain",
  Osmosis: "osmosis",
  Fantom: "fantom",
  Celo: "celo",
  Cronos: "cronos",
  Kava: "kava",
  Filecoin: "filecoin",
  CORE: "core",
  Moonbeam: "moonbeam",
  zkSync: "zksync",
};

type ProtocolPayload = {
  name: string;
  tvl: number;
  category: string;
};

type CoinPayload = {
  name: string;
  symbol: string;
  slug: string;
  price: number;
  change_24h: number | null;
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

async function fetchCoinsForPlatform(
  platformId: string,
  limit: number
): Promise<CoinPayload[]> {
  let coinIds: string[] = [];
  try {
    const listRes = await fetch(COINGECKO_LIST, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!listRes.ok) return [];
    const list = (await listRes.json()) as Array<{
      id?: string;
      platforms?: Record<string, string>;
    }>;
    if (!Array.isArray(list)) return [];
    coinIds = list
      .filter((c) => c.platforms && platformId in c.platforms)
      .map((c) => c.id)
      .filter(Boolean) as string[];
  } catch {
    return [];
  }

  if (coinIds.length === 0) return [];
  const idsParam = coinIds.slice(0, 100).join(",");
  const url = `${COINGECKO_MARKETS_BASE}?vs_currency=usd&ids=${encodeURIComponent(idsParam)}&order=market_cap_desc&per_page=${limit}&sparkline=false&price_change_percentage=24h`;

  try {
    const res = await fetch(url, {
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
  } catch {
    return [];
  }
}

export type ExpansionResponse = {
  protocols: ProtocolPayload[];
  coins: CoinPayload[];
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
        if (data && (data.protocols?.length > 0 || data.coins?.length > 0)) {
          return NextResponse.json(data);
        }
      }
    } catch {
      // fall through
    }
  }

  const platformId =
    CHAIN_TO_PLATFORM[chainName] ??
    CHAIN_TO_PLATFORM[chainName.trim()] ??
    Object.entries(CHAIN_TO_PLATFORM).find(
      ([k]) => k.toLowerCase() === chainName.toLowerCase()
    )?.[1] ??
    chainName.toLowerCase().replace(/\s+/g, "-");

  const [protocols, coins] = await Promise.all([
    fetchProtocolsForChain(chainName, limit),
    fetchCoinsForPlatform(platformId, limit),
  ]);

  return NextResponse.json({ protocols, coins });
}
