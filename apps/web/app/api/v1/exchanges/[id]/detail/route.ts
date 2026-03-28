import { NextResponse } from "next/server";
import type { ExchangeCgDetailPayload, ExchangeCgTopTicker } from "@/lib/exchange-liquidity-types";

const CG = "https://api.coingecko.com/api/v3";
const TOP_K = 25;

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function numVol(t: Record<string, unknown>): number {
  const cv = t.converted_volume;
  if (cv && typeof cv === "object" && "usd" in cv) {
    return Number((cv as { usd?: unknown }).usd) || 0;
  }
  return Number(cv) || 0;
}

function spreadPct(t: Record<string, unknown>): number | null {
  const v = t.bid_ask_spread_percentage;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${CG}/exchanges/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 120 },
    });
  } catch {
    return NextResponse.json({ error: "Upstream failed" }, { status: 502 });
  }

  if (res.status === 404) {
    return NextResponse.json({ error: "Exchange not found" }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "CoinGecko error" }, { status: 502 });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await res.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 502 });
  }

  const tickersRaw = Array.isArray(raw.tickers)
    ? (raw.tickers as Record<string, unknown>[])
    : [];

  const sorted = [...tickersRaw].sort((a, b) => numVol(b) - numVol(a));

  const top_tickers: ExchangeCgTopTicker[] = sorted.slice(0, TOP_K).map((t) => ({
    base: String(t.base ?? ""),
    target: String(t.target ?? ""),
    converted_volume_usd: numVol(t),
    bid_ask_spread_percentage: spreadPct(t),
    trade_url: t.trade_url ? String(t.trade_url) : null,
    coin_id: t.coin_id != null ? String(t.coin_id) : null,
  }));

  const descRaw = raw.description;
  const description =
    typeof descRaw === "string" ? stripHtml(descRaw).slice(0, 12_000) : "";

  const normUsd = Number(
    raw.trade_volume_24h_normalized_usd ??
      raw.trade_volume_24h_btc_normalized ??
      0,
  );
  const pairsTotal = Number(raw.pairs);
  const tickersCount = Number.isFinite(pairsTotal) && pairsTotal > 0 ? pairsTotal : tickersRaw.length;

  const payload: ExchangeCgDetailPayload = {
    id: String(raw.id ?? id),
    name: String(raw.name ?? id),
    image: String(raw.image ?? ""),
    url: String(raw.url ?? ""),
    country: raw.country != null ? String(raw.country) : null,
    year_established:
      raw.year_established != null ? Number(raw.year_established) : null,
    trust_score: Number(raw.trust_score) || 0,
    trust_score_rank: Number(raw.trust_score_rank) || 999,
    trade_volume_24h_btc: Number(raw.trade_volume_24h_btc) || 0,
    trade_volume_24h_normalized_usd: Number.isFinite(normUsd) ? normUsd : 0,
    tickers_count: tickersCount,
    centralized:
      typeof raw.centralized === "boolean" ? raw.centralized : null,
    description,
    top_tickers,
  };

  return NextResponse.json(payload);
}
