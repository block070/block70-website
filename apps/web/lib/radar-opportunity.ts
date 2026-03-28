import type { AIInsightDto, MarketNarrativeDto } from "@/lib/api";
import type { CoinListItemDto } from "@/lib/coins";
import type { RadarEventDto } from "@/lib/types";

export type RadarCoinEnrichment = {
  slug: string;
  market_cap_usd: number | null;
  volume_24h_usd: number | null;
  change_24h_pct: number | null;
  market_cap_rank: number | null;
  match_quality: "unique" | "ambiguous" | "none";
};

const LOW_MCAP_USD = 500_000_000; // "smaller cap" tilt — label in UI
const HIGH_VOL_CHANGE_RATIO = 2; // volume vs mcap heuristic when change high

/** Build uppercase symbol → enrichment from paginated coin list (top-of-book). */
export function buildCoinEnrichmentMap(items: CoinListItemDto[]): Map<string, RadarCoinEnrichment> {
  const bySym = new Map<string, CoinListItemDto[]>();
  for (const row of items) {
    const s = row.coin.symbol?.toUpperCase().trim();
    if (!s) continue;
    const arr = bySym.get(s) ?? [];
    arr.push(row);
    bySym.set(s, arr);
  }
  const out = new Map<string, RadarCoinEnrichment>();
  for (const [sym, rows] of bySym) {
    const sorted = [...rows].sort(
      (a, b) =>
        (a.coin.market_cap_rank ?? 99_999) - (b.coin.market_cap_rank ?? 99_999),
    );
    const r = sorted[0]!;
    const md = r.latest_market_data;
    const enrichment: RadarCoinEnrichment = {
      slug: r.coin.slug,
      market_cap_usd: r.coin.market_cap ?? md?.market_cap ?? null,
      volume_24h_usd: r.coin.volume_24h ?? md?.volume_24h ?? null,
      change_24h_pct: md?.price_change_24h ?? null,
      market_cap_rank: r.coin.market_cap_rank ?? null,
      match_quality: rows.length > 1 ? "ambiguous" : "unique",
    };
    out.set(sym, enrichment);
  }
  return out;
}

export function getEnrichmentForSymbol(
  map: Map<string, RadarCoinEnrichment>,
  tokenSymbol: string | undefined | null,
): RadarCoinEnrichment | undefined {
  if (!tokenSymbol) return undefined;
  return map.get(tokenSymbol.toUpperCase().trim());
}

/** Weighted Block70 composite (0–100 scale for display). */
export function discoveryScorePercent(ev: RadarEventDto): number {
  const evScore = clamp01(ev.event_score);
  const conf = clamp01(ev.avg_confidence_score);
  const rec = clamp01(ev.recency_score);
  const countNorm = Math.min(1, (ev.signal_count ?? 0) / 10);
  const diversity = Math.min(1, (ev.signal_types?.length ?? 0) / 4);
  const raw =
    evScore * 0.4 +
    conf * 0.25 +
    rec * 0.2 +
    countNorm * 0.1 +
    diversity * 0.05;
  return Math.round(raw * 100);
}

function clamp01(x: number | null | undefined): number {
  if (x == null || Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export type RadarRiskTier = "elevated" | "balanced" | "speculative";

/** Heuristic risk from signal mix — not a formal risk model. */
export function riskTierFromSignals(ev: RadarEventDto): RadarRiskTier {
  const types = new Set((ev.signal_types ?? []).map((t) => t.toLowerCase()));
  const socialHeavy =
    types.has("social_mentions_spike") &&
    !types.has("wallet_accumulation") &&
    !types.has("dex_volume_spike");
  const volHeavy =
    types.has("dex_volume_spike") || types.has("liquidity_increase");
  if (socialHeavy && !volHeavy) return "speculative";
  if (types.has("wallet_accumulation") && volHeavy) return "balanced";
  if (types.size >= 3) return "balanced";
  return "elevated";
}

export function signalTypeLabel(t: string): string {
  switch (t.toLowerCase()) {
    case "wallet_accumulation":
      return "Wallet flow";
    case "dex_volume_spike":
      return "Volume thrust";
    case "liquidity_increase":
      return "Liquidity shift";
    case "dev_activity_spike":
      return "Developer activity";
    case "social_mentions_spike":
      return "Social attention";
    default:
      return t.replace(/_/g, " ");
  }
}

export function earlySignalBadges(ev: RadarEventDto): string[] {
  const badges: string[] = [];
  const types = ev.signal_types ?? [];
  const et = (ev.event_type ?? "").toLowerCase();
  if (types.some((x) => x.includes("volume") || x.includes("dex"))) badges.push("Volume signal");
  if (types.some((x) => x.includes("wallet") || x.includes("accumulation")))
    badges.push("Wallet activity");
  if (types.some((x) => x.includes("social"))) badges.push("Attention spike");
  if (types.some((x) => x.includes("dev"))) badges.push("Build activity");
  if (et.includes("listing") || et.includes("new")) badges.push("New listing");
  if (badges.length === 0 && ev.description)
    badges.push("Anomaly");
  return [...new Set(badges)].slice(0, 4);
}

export function headlineForEvent(ev: RadarEventDto): string {
  if (ev.description?.trim()) return ev.description.trim().slice(0, 160);
  const sym = ev.token_symbol ?? "Token";
  const types = (ev.signal_types ?? []).slice(0, 2).map(signalTypeLabel);
  if (types.length)
    return `${sym}: ${types.join(" · ")}`;
  return `${sym}: radar activity detected`;
}

export function pickNarrativeLine(
  symbol: string,
  narratives: MarketNarrativeDto[],
  insights: AIInsightDto[],
): string | null {
  const u = symbol.toUpperCase();
  for (const n of narratives) {
    const blob = `${n.name} ${n.description ?? ""}`.toUpperCase();
    if (blob.includes(u) || blob.includes(`$${u}`)) return n.name;
  }
  for (const i of insights) {
    if ((i.related_tokens ?? []).some((t) => t.toUpperCase() === u)) {
      return i.title?.slice(0, 80) ?? null;
    }
  }
  return null;
}

export function mergeRadarEvents(list: RadarEventDto[], top: RadarEventDto[]): RadarEventDto[] {
  const map = new Map<string, RadarEventDto>();
  const rank = (e: RadarEventDto) =>
    (e.event_score ?? 0) +
    (e.severity_score ?? 0) * 0.3 +
    (e.avg_confidence_score ?? 0) * 0.2;
  for (const e of [...top, ...list]) {
    const key = (e.token_symbol ?? "").toUpperCase().trim();
    if (!key) continue;
    const prev = map.get(key);
    if (!prev || rank(e) > rank(prev)) map.set(key, { ...e, token_symbol: key });
  }
  return [...map.values()];
}

export function passesMarketFilters(
  enrichment: RadarCoinEnrichment | undefined,
  opts: { lowMcap: boolean; highVolumeGrowth: boolean; newListing: boolean },
): boolean {
  if (!opts.lowMcap && !opts.highVolumeGrowth && !opts.newListing) return true;
  if (!enrichment || enrichment.match_quality === "none") return false;

  let ok = false;
  if (opts.lowMcap) {
    const m = enrichment.market_cap_usd;
    if (m != null && m > 0 && m < LOW_MCAP_USD) ok = true;
  }
  if (opts.highVolumeGrowth) {
    const v = enrichment.volume_24h_usd;
    const m = enrichment.market_cap_usd;
    const ch = enrichment.change_24h_pct;
    if (
      v != null &&
      m != null &&
      m > 0 &&
      v > m * HIGH_VOL_CHANGE_RATIO &&
      (ch == null || ch > 3)
    )
      ok = true;
    if (ch != null && ch > 8) ok = true;
  }
  if (opts.newListing) {
    // Without listing date in join, only hint via rank deep
    const r = enrichment.market_cap_rank;
    if (r != null && r > 200) ok = true;
  }
  return ok;
}
