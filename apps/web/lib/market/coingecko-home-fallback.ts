/**
 * When the FastAPI market routes are unreachable from the Next.js host (missing API_SERVER_URL),
 * fetch CoinGecko directly — same /global + /coins/markets sources the API uses.
 */
import type { MarketCoin } from "@/lib/api";

const CG_BASE =
  (typeof process !== "undefined" && process.env.COINGECKO_API_BASE) ||
  "https://api.coingecko.com/api/v3";

export type CoingeckoGlobalNumbers = {
  total_market_cap_usd: number | null;
  total_volume_usd: number | null;
  btc_dominance_pct: number | null;
  eth_dominance_pct: number | null;
};

async function cgGet(path: string, search: Record<string, string>): Promise<Response> {
  const u = new URL(`${CG_BASE}${path}`);
  for (const [k, v] of Object.entries(search)) u.searchParams.set(k, v);
  const headers: Record<string, string> = { Accept: "application/json" };
  const key = typeof process !== "undefined" ? process.env.COINGECKO_API_KEY : undefined;
  if (key) headers["x-cg-demo-api-key"] = key;
  return fetch(u.toString(), { cache: "no-store", headers });
}

export async function fetchCoingeckoGlobal(): Promise<CoingeckoGlobalNumbers | null> {
  try {
    const res = await cgGet("/global", {});
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: Record<string, unknown> };
    const inner = body.data ?? {};
    const mcap = inner.total_market_cap as { usd?: number } | undefined;
    const vol = inner.total_volume as { usd?: number } | undefined;
    const pct = inner.market_cap_percentage as { btc?: number; eth?: number } | undefined;
    return {
      total_market_cap_usd:
        mcap?.usd != null && Number.isFinite(mcap.usd) ? Number(mcap.usd) : null,
      total_volume_usd: vol?.usd != null && Number.isFinite(vol.usd) ? Number(vol.usd) : null,
      btc_dominance_pct:
        pct?.btc != null && Number.isFinite(pct.btc) ? Number(pct.btc) : null,
      eth_dominance_pct:
        pct?.eth != null && Number.isFinite(pct.eth) ? Number(pct.eth) : null,
    };
  } catch {
    return null;
  }
}

export async function fetchCoingeckoMarketsTop(perPage = 100): Promise<MarketCoin[]> {
  try {
    const res = await cgGet("/coins/markets", {
      vs_currency: "usd",
      order: "market_cap_desc",
      per_page: String(Math.min(100, Math.max(1, perPage))),
      page: "1",
      sparkline: "false",
      price_change_percentage: "24h,7d",
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => {
      const id = typeof r.id === "string" ? r.id : "";
      const sym = typeof r.symbol === "string" ? r.symbol.toUpperCase() : "";
      const price = r.current_price;
      const ch24 = r.price_change_percentage_24h;
      const ch7 = r.price_change_percentage_7d_in_currency ?? r.price_change_percentage_7d;
      return {
        name: typeof r.name === "string" ? r.name : sym || id,
        symbol: sym,
        price: typeof price === "number" && Number.isFinite(price) ? price : null,
        change_24h: typeof ch24 === "number" && Number.isFinite(ch24) ? ch24 : null,
        change_7d: typeof ch7 === "number" && Number.isFinite(ch7) ? ch7 : null,
        market_cap: typeof r.market_cap === "number" ? r.market_cap : null,
        volume: typeof r.total_volume === "number" ? r.total_volume : null,
        slug: id,
        logo_url: typeof r.image === "string" ? r.image : null,
      } satisfies MarketCoin;
    });
  } catch {
    return [];
  }
}

export async function fetchCoingeckoHomeMarketBundle(perPage = 100): Promise<{
  global: CoingeckoGlobalNumbers | null;
  coins: MarketCoin[];
}> {
  const [global, coins] = await Promise.all([
    fetchCoingeckoGlobal(),
    fetchCoingeckoMarketsTop(perPage),
  ]);
  return { global, coins };
}
