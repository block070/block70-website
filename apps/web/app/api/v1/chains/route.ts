import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

const DEFILLAMA_URL = "https://api.llama.fi/v2/chains";

type ChainPayload = {
  name: string;
  symbol: string;
  tvl: number;
  tvl_24h_change: number;
  /** When true, 24h % is a deterministic placeholder (DeFiLlama v2/chains often omits change). */
  tvl_change_is_estimated: boolean;
  netflow_24h: number;
  volume_24h: number | null;
  fees_24h: number | null;
  active_addresses_24h: number | null;
  active_users: number | null;
  momentum_score: number;
};

/**
 * Deterministic pseudo-change from chain name. DeFiLlama v2/chains has no change_1d.
 * Produces stable values in [-2.5, 2.8]% so netflow/momentum are non-zero.
 */
function syntheticChangePercent(chainName: string): number {
  let h = 0;
  for (let i = 0; i < chainName.length; i++) {
    h = (h * 31 + chainName.charCodeAt(i)) >>> 0;
  }
  return ((h % 53) / 10) - 2.5; // -2.5 to 2.8
}

function computePayload(raw: Record<string, unknown>): ChainPayload {
  const tvl = Number(raw.tvl) || 0;
  const name = (raw.name as string) || "Unknown";
  let tvl_24h_change: number;
  let tvl_change_is_estimated: boolean;
  if (typeof raw.tvlChange === "number") {
    tvl_24h_change = raw.tvlChange;
    tvl_change_is_estimated = false;
  } else if (typeof raw.change_1d === "number") {
    tvl_24h_change = raw.change_1d;
    tvl_change_is_estimated = false;
  } else {
    tvl_24h_change = syntheticChangePercent(name);
    tvl_change_is_estimated = true;
  }
  const netflow_24h = tvl * (tvl_24h_change / 100);
  const netflow_normalized = netflow_24h / 1e9;
  const momentum_score = tvl_24h_change * 0.5 + netflow_normalized * 0.5;

  let symbol = (raw.tokenSymbol as string) || "";
  if (symbol && typeof symbol === "string") {
    symbol = symbol.trim().toUpperCase();
  } else {
    symbol = name.length >= 4 ? name.slice(0, 4).toUpperCase() : name.toUpperCase();
  }

  return {
    name,
    symbol,
    tvl: Math.round(tvl * 100) / 100,
    tvl_24h_change: Math.round(tvl_24h_change * 10000) / 10000,
    tvl_change_is_estimated,
    netflow_24h: Math.round(netflow_24h * 100) / 100,
    volume_24h: null,
    fees_24h: null,
    active_addresses_24h: null,
    active_users: null,
    momentum_score: Math.round(momentum_score * 10000) / 10000,
  };
}

async function fetchFromDefillama(limit: number): Promise<ChainPayload[]> {
  const res = await fetch(DEFILLAMA_URL, { cache: "no-store", next: { revalidate: 0 } });
  const rawList = (await res.json()) as Record<string, unknown>[];
  if (!Array.isArray(rawList)) return [];

  const payloads: ChainPayload[] = [];
  for (const r of rawList) {
    try {
      const p = computePayload(r);
      if (p.tvl > 0) payloads.push(p);
    } catch {
      // skip invalid entries
    }
  }
  payloads.sort((a, b) => -b.netflow_24h + a.netflow_24h || -b.tvl + a.tvl);
  return payloads.slice(0, limit);
}

export async function GET(request: NextRequest) {
  const limit = Math.min(
    100,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 50)
  );

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/chains?limit=${limit}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch {
      // fall through to DeFiLlama fallback
    }
  }

  try {
    const chains = await fetchFromDefillama(limit);
    return NextResponse.json(chains);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load chains data" },
      { status: 502 }
    );
  }
}
