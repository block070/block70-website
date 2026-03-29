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
  /** Human-readable sector / category when known */
  categoryLabel?: string | null;
};

export type OpportunityLabel = "Buy" | "Hold" | "Risky";

export type OpportunityCard = EnrichedCoinRow & {
  label: OpportunityLabel;
};

export type DataSnapshot = {
  marketTrend: "Bull" | "Bear" | "Neutral";
  volumeTrend: "Rising" | "Falling" | "Stable";
  topSector: string;
};

export type StructuredAnswer = {
  /** 2–3 sentences max for TLDR */
  summary: string;
  /** Short bold line (key takeaway) */
  boldTakeaway: string;
  insights: string[];
  recommendation: "Buy" | "Hold" | "Avoid";
  /** Buy / Wait / Avoid for primary CTA copy */
  bestAction: "Buy" | "Wait" | "Avoid";
  block70SignalLine: string;
  whaleNote: string | null;
  opportunities: OpportunityCard[];
  dataSnapshot: DataSnapshot;
  whyReasons: { sources: string[]; indicators: string[] };
};

function opportunityLabel(score: number): OpportunityLabel {
  if (score >= 62) return "Buy";
  if (score >= 38) return "Hold";
  return "Risky";
}

export function rowsToOpportunities(rows: EnrichedCoinRow[], max = 5): OpportunityCard[] {
  return rows.slice(0, max).map((r) => ({
    ...r,
    label: opportunityLabel(r.block70Score),
  }));
}

/** Dedupe by slug; first wins (instant matches stay on top). */
export function mergeUniqueBySlug(rows: EnrichedCoinRow[]): EnrichedCoinRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (!r.slug || seen.has(r.slug)) return false;
    seen.add(r.slug);
    return true;
  });
}

function slugFromHref(href: string): string | null {
  const m = href.match(/\/coins\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Resolve slug from /coins/… search hits into enriched rows (for instant top 3). */
export async function enrichSearchHitsToRows(cards: InstantCoinCard[]): Promise<EnrichedCoinRow[]> {
  const out: EnrichedCoinRow[] = [];
  for (const c of cards) {
    const slug = c.href ? slugFromHref(c.href) : null;
    if (!slug) continue;
    try {
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
      out.push(coinToModel(coin, detail.coin.category ?? null));
    } catch {
      /* skip */
    }
  }
  return out;
}

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

function coinToModel(c: Coin, categoryLabel?: string | null): EnrichedCoinRow {
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
    categoryLabel: categoryLabel ?? null,
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
    return coinToModel(coin, detail.coin.category ?? null);
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

function buildDataSnapshot(rows: EnrichedCoinRow[]): DataSnapshot {
  if (rows.length === 0) {
    return {
      marketTrend: "Neutral",
      volumeTrend: "Stable",
      topSector: "Mixed / multi-sector",
    };
  }
  let bulls = 0;
  let bears = 0;
  let chgSum = 0;
  for (const r of rows) {
    if (r.trendLabel === "Bull") bulls += 1;
    else if (r.trendLabel === "Bear") bears += 1;
    chgSum += r.change24hPct;
  }
  const avgChg = chgSum / rows.length;
  let marketTrend: DataSnapshot["marketTrend"] = "Neutral";
  if (bulls > bears + 1) marketTrend = "Bull";
  else if (bears > bulls + 1) marketTrend = "Bear";

  let volumeTrend: DataSnapshot["volumeTrend"] = "Stable";
  if (avgChg > 1.2) volumeTrend = "Rising";
  else if (avgChg < -1.2) volumeTrend = "Falling";

  const sector =
    rows.map((r) => r.categoryLabel).find((s) => s && s.trim()) ?? "Mixed / multi-sector";

  return { marketTrend, volumeTrend, topSector: sector };
}

function buildWhyReasons(result: AISearchResult): { sources: string[]; indicators: string[] } {
  const sources: string[] = [];
  if (result.related_signals?.length) sources.push("Live signals feed");
  if (result.related_radar?.length) sources.push("Radar: volume & unusual activity");
  if (result.related_opportunities?.length) sources.push("Opportunity scanner");
  if (result.related_insights?.length) sources.push("AI insights index");
  if (result.related_narratives?.length) sources.push("Narrative momentum index");
  if (result.related_capital_flows?.length) sources.push("Capital flow ledger");
  if (result.related_wallet_activity?.length) sources.push("Smart wallet leaderboard clips");
  sources.push("Coin market data & Block70 composite scores");

  const indicators = [
    "Block70 score (0–100) from momentum + liquidity",
    "24h & 7d price momentum",
    "Volume vs market cap (liquidity context)",
    "Platform confidence from breadth of matching data",
  ];
  return { sources: [...new Set(sources)], indicators };
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
  const summaryBody = sentences.slice(0, 3).join(" ");
  const summary =
    summaryBody ||
    text.slice(0, 280) ||
    "Block70 synthesized platform data for your question. Use the cards below for actionable context.";
  const boldTakeaway =
    sentences[0]?.slice(0, 220) ||
    summary.slice(0, 140) ||
    "Focus on score, liquidity, and your own risk limits before sizing any position.";

  let insightParts = sentences.slice(1, 8);
  if (insightParts.length < 3 && text.length > 80) {
    insightParts = [
      ...insightParts,
      ...text
        .split(/[.;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 15)
        .slice(0, 5),
    ];
  }
  const uniqInsights = [...new Set(insightParts)].slice(0, 5);

  const merged = mergeUniqueBySlug(enriched);
  const opportunities = rowsToOpportunities(merged, 5);

  const avgScore =
    merged.length > 0
      ? merged.reduce((s, r) => s + r.block70Score, 0) / merged.length
      : 50 * result.confidence_score + 25;
  const scoreRounded = Math.round(Math.min(100, Math.max(0, avgScore)));

  let recommendation: "Buy" | "Hold" | "Avoid" = "Hold";
  if (result.confidence_score >= 0.55 && scoreRounded >= 58) recommendation = "Buy";
  else if (result.confidence_score < 0.35 || scoreRounded < 32) recommendation = "Avoid";

  const bestAction: StructuredAnswer["bestAction"] =
    recommendation === "Buy" ? "Buy" : recommendation === "Avoid" ? "Avoid" : "Wait";

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
    boldTakeaway,
    insights: uniqInsights,
    recommendation,
    bestAction,
    block70SignalLine,
    whaleNote,
    opportunities,
    dataSnapshot: buildDataSnapshot(merged),
    whyReasons: buildWhyReasons(result),
  };
}

export function recommendationBadgeClass(
  r: StructuredAnswer["recommendation"]
): string {
  if (r === "Buy") return "border-emerald-500/50 bg-emerald-500/15 text-emerald-200";
  if (r === "Avoid") return "border-red-500/45 bg-red-500/10 text-red-200";
  return "border-amber-500/40 bg-amber-500/10 text-amber-100";
}

export function bestActionBadgeClass(a: StructuredAnswer["bestAction"]): string {
  if (a === "Buy") return "border-emerald-500/50 bg-emerald-500/20 text-emerald-100";
  if (a === "Avoid") return "border-red-500/45 bg-red-500/15 text-red-100";
  return "border-sky-500/40 bg-sky-950/40 text-sky-100";
}

export function opportunityLabelBadgeClass(label: OpportunityLabel): string {
  if (label === "Buy") return "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/35";
  if (label === "Hold") return "bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/30";
  return "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/35";
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
  "Which one is safest?",
  "Which has the highest ROI?",
  "What are the risks?",
  "Drill into risk factors",
  "Show me the top signal tickers",
  "How does this compare to last week?",
] as const;

export type SourceSummary = {
  newsHref: string;
  marketHref: string;
  walletsHref: string;
  hasRadar: boolean;
  narrativeCount: number;
  signalCount: number;
  flowCount: number;
  walletClipCount: number;
};

export function buildSourceSummary(result: AISearchResult): SourceSummary {
  return {
    newsHref: "/news",
    marketHref: "/market",
    walletsHref: "/smartwallets",
    hasRadar: (result.related_radar?.length ?? 0) > 0,
    narrativeCount: result.related_narratives?.length ?? 0,
    signalCount: result.related_signals?.length ?? 0,
    flowCount: result.related_capital_flows?.length ?? 0,
    walletClipCount: result.related_wallet_activity?.length ?? 0,
  };
}
