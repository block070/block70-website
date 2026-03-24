import type { AISearchResult } from "@/lib/ai-search-api";
import { computeBlock70Score, trendFromMomentum, type TrendLabel } from "@/lib/coins-scanner";
import { getCoinBySlug } from "@/lib/coins";
import type { Coin } from "@/lib/crypto-mock";
import { formatChangePct, formatCompactUsd } from "@/lib/format";

export type InstantCoinCard = {
  id: string;
  title: string;
  href: string;
  category?: string;
  score?: number;
  price_change_24h?: number;
};

export type EnrichedCoinRow = {
  symbol: string;
  slug: string;
  name: string;
  priceUsd: number;
  change24hPct: number;
  marketCapUsd: number;
  volume24hUsd: number;
  block70Score: number;
  trendLabel: TrendLabel;
};

export type StructuredAnswer = {
  summary: string;
  insights: string[];
  recommendation: "Buy" | "Hold" | "Avoid";
  block70SignalLine: string;
  whaleNote: string | null;
};

/** Fetch top search hits for instant cards (same-origin). */
export async function fetchInstantCoinCards(query: string, limit = 6): Promise<InstantCoinCard[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: InstantCoinCard[] };
    const raw = Array.isArray(data.results) ? data.results : [];
    return raw.filter((r) => r.href?.startsWith("/coins/")).slice(0, limit);
  } catch {
    return [];
  }
}

function slugFromHref(href: string): string | null {
  const m = href.match(/\/coins\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function coinToModel(c: Coin): EnrichedCoinRow {
  const block70Score = computeBlock70Score(c);
  const p24 = typeof c.change24hPct === "number" && Number.isFinite(c.change24hPct) ? c.change24hPct : 0;
  const p7 = typeof c.change7dPct === "number" && Number.isFinite(c.change7dPct) ? c.change7dPct : 0;
  return {
    symbol: c.symbol,
    slug: c.slug,
    name: c.name,
    priceUsd: c.priceUsd,
    change24hPct: p24,
    marketCapUsd: c.marketCapUsd,
    volume24hUsd: c.volume24hUsd,
    block70Score,
    trendLabel: trendFromMomentum(p24, p7),
  };
}

async function resolveCoinBySymbol(symbol: string): Promise<EnrichedCoinRow | null> {
  const sym = symbol.trim();
  if (!sym) return null;
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(sym)}&limit=3`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: { href?: string; title?: string }[] };
    const first = data.results?.find((r) => r.href?.includes("/coins/"));
    const slug = first?.href ? slugFromHref(first.href) : null;
    if (!slug) return null;
    const detail = await getCoinBySlug(slug);
    const md = detail.market_data?.[0];
    const coin: Coin = {
      id: String(detail.coin.id),
      slug: detail.coin.slug,
      symbol: detail.coin.symbol,
      name: detail.coin.name,
      priceUsd: detail.coin.price ?? md?.price ?? 0,
      marketCapUsd: detail.coin.market_cap ?? md?.market_cap ?? 0,
      volume24hUsd: detail.coin.volume_24h ?? md?.volume_24h ?? 0,
      change24hPct: md?.price_change_24h ?? Number.NaN,
      change7dPct: md?.price_change_7d ?? Number.NaN,
      rank: detail.coin.market_cap_rank ?? 0,
      categoryIds: detail.coin.category ? [detail.coin.category] : [],
      chainIds: detail.coin.chain ? [detail.coin.chain] : [],
      logoUrl: detail.coin.logo_url ?? undefined,
    };
    return coinToModel(coin);
  } catch {
    return null;
  }
}

/** Live rows for related token symbols (parallel, capped). */
export async function enrichRelatedTokens(symbols: string[]): Promise<EnrichedCoinRow[]> {
  const uniq = [...new Set(symbols.map((s) => s.trim()).filter(Boolean))].slice(0, 8);
  const rows = await Promise.all(uniq.map((s) => resolveCoinBySymbol(s)));
  return rows.filter((r): r is EnrichedCoinRow => r != null);
}

function signalLabelFromScore(score: number): string {
  if (score >= 82) return "Strong Buy";
  if (score >= 68) return "Buy";
  if (score >= 45) return "Hold / Neutral";
  if (score >= 30) return "Caution";
  return "Avoid";
}

export function buildStructuredAnswer(
  result: AISearchResult,
  enriched: EnrichedCoinRow[]
): StructuredAnswer {
  const text = (result.answer || "").trim();
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const summary =
    sentences[0] ||
    text.slice(0, 220) ||
    "Block70 synthesized platform data for your question.";
  let insightParts = sentences.slice(1, 6);
  if (insightParts.length < 2 && text.length > 80) {
    insightParts = [
      ...insightParts,
      ...text
        .split(/[.;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20)
        .slice(0, 4),
    ];
  }
  const uniqInsights = [...new Set(insightParts)].slice(0, 5);

  const avgScore =
    enriched.length > 0
      ? enriched.reduce((s, r) => s + r.block70Score, 0) / enriched.length
      : 50 * result.confidence_score + 25;
  const scoreRounded = Math.round(Math.min(100, Math.max(0, avgScore)));

  let recommendation: "Buy" | "Hold" | "Avoid" = "Hold";
  if (result.confidence_score >= 0.55 && scoreRounded >= 58) recommendation = "Buy";
  else if (result.confidence_score < 0.35 || scoreRounded < 32) recommendation = "Avoid";

  const block70SignalLine = `Block70 Signal: ${signalLabelFromScore(scoreRounded)} (Score: ${scoreRounded})`;

  const radar = result.related_radar?.[0];
  const whaleNote =
    radar?.description || radar?.token_symbol
      ? `Whale / radar: ${radar.token_symbol ?? "—"} — ${(radar.event_type as string) ?? "activity"}${radar.severity_score != null ? ` (severity ${((radar.severity_score as number) * 100).toFixed(0)}%)` : ""}`
      : result.related_signals?.[0]?.title
        ? `Signal focus: ${result.related_signals[0].token_symbol ?? ""} — ${result.related_signals[0].title ?? ""}`
        : null;

  return {
    summary,
    insights: uniqInsights,
    recommendation,
    block70SignalLine,
    whaleNote,
  };
}

export function recommendationBadgeClass(
  r: StructuredAnswer["recommendation"]
): string {
  if (r === "Buy") return "border-emerald-500/50 bg-emerald-500/15 text-emerald-200";
  if (r === "Avoid") return "border-red-500/45 bg-red-500/10 text-red-200";
  return "border-amber-500/40 bg-amber-500/10 text-amber-100";
}

export function formatCoinDataRow(r: EnrichedCoinRow): string {
  return `${r.name} (${r.symbol}) — ${formatCompactUsd(r.priceUsd)} · ${formatChangePct(r.change24hPct)} · Score ${r.block70Score} · ${r.trendLabel}`;
}

/** Simulate token streaming for UX (backend returns full text). */
export async function streamTextChunks(
  fullText: string,
  onChunk: (soFar: string) => void,
  options?: { msPerChunk?: number; chunkSize?: number }
): Promise<void> {
  const ms = options?.msPerChunk ?? 12;
  const size = options?.chunkSize ?? 3;
  let i = 0;
  while (i < fullText.length) {
    i = Math.min(fullText.length, i + size);
    onChunk(fullText.slice(0, i));
    await new Promise((r) => setTimeout(r, ms));
  }
}

export const FOLLOW_UP_SUGGESTIONS = [
  "Should I buy this now?",
  "What are similar coins?",
  "What's the risk level?",
  "Show me the latest signals for this narrative.",
  "What is moving volume today?",
] as const;
