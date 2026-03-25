/**
 * Crypto news ranking: cluster similar articles into topics, score 0–100, return top N.
 * Weights: source 20%, recency 15%, frequency 20%, keywords 20%, assets 15%, sentiment 10%.
 */
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArticleInput = {
  /** Stable id if available (improves topic idempotency) */
  id?: string;
  title: string;
  content: string;
  source: string;
  publishedAt: string | Date;
  /** Tickers or symbols, e.g. BTC, ETH */
  mentionedAssets: string[];
};

export type RankedTopic = {
  id: string;
  headline: string;
  articles: ArticleInput[];
  /** Composite score 0–100 after spike multiplier */
  score: number;
  /** Multiplier applied (1 = none) */
  spikeMultiplier: number;
  /** Debugging / transparency */
  breakdown: {
    sourceScore: number;
    recencyScore: number;
    frequencyScore: number;
    impactScore: number;
    assetScore: number;
    sentimentScore: number;
    baseScoreBeforeSpike: number;
  };
};

export type RankerOptions = {
  now?: Date;
  topN?: number;
  /** Jaccard similarity threshold for grouping (0–1) */
  clusterThreshold?: number;
  /** Recency half-life in hours (exponential decay) */
  recencyHalfLifeHours?: number;
  /** Max cluster size used to normalize frequency score */
  frequencyCap?: number;
  /** Denominator to normalize raw keyword sums into 0–1 */
  keywordImpactCap?: number;
  /** Recent window for spike detection (ms) */
  spikeRecentWindowMs?: number;
  /** Earlier window for baseline rate (ms), non-overlapping after recent */
  spikeBaselineWindowMs?: number;
  /** If observed/expected article rate in recent window exceeds this, apply boost */
  spikeRatioThreshold?: number;
  /** Max extra multiplier above 1 (e.g. 0.2 → up to 1.2x) */
  spikeMaxBoost?: number;
  /** Override default source → authority (0–1) */
  sourceAuthority?: Record<string, number>;
  /** Override asset → weight (0–1) */
  assetWeights?: Record<string, number>;
};

type SpikeOptionKeys = "spikeRecentWindowMs" | "spikeBaselineWindowMs" | "spikeRatioThreshold" | "spikeMaxBoost";
type SpikeOptionsResolved = Required<Pick<RankerOptions, SpikeOptionKeys>>;

// ---------------------------------------------------------------------------
// Defaults (tunable without code changes via options)
// ---------------------------------------------------------------------------

const DEFAULT_SOURCE_AUTHORITY: Record<string, number> = {
  reuters: 1,
  bloomberg: 1,
  "financial times": 0.98,
  wsj: 0.97,
  ft: 0.98,
  coindesk: 0.88,
  theblock: 0.88,
  "the block": 0.88,
  cointelegraph: 0.78,
  decrypt: 0.76,
  cryptopanic: 0.55,
  twitter: 0.45,
  x: 0.45,
};

const DEFAULT_ASSET_WEIGHTS: Record<string, number> = {
  BTC: 1,
  BITCOIN: 1,
  ETH: 0.95,
  ETHEREUM: 0.95,
  SOL: 0.82,
  USDT: 0.65,
  USDC: 0.65,
  BNB: 0.8,
  XRP: 0.78,
  DOGE: 0.72,
  ADA: 0.7,
};

/** Keyword → raw impact weight (summed, then normalized) */
const IMPACT_KEYWORDS: [string, number][] = [
  ["sec ", 2],
  [" etf", 2],
  ["regulation", 1.6],
  ["lawsuit", 1.7],
  ["hack", 2.1],
  ["exploit", 2.1],
  ["outage", 1.2],
  ["binance", 1.1],
  ["coinbase", 1.1],
  ["fed ", 1.4],
  ["interest rate", 1.3],
  ["bitcoin", 1],
  ["ethereum", 1],
  ["whale", 1],
  ["liquidat", 1.2],
  ["approval", 1.3],
  ["reject", 1.5],
];

const POSITIVE_LEX: string[] = [
  "surge",
  "rally",
  "approval",
  "breakthrough",
  "record high",
  "bullish",
  "gain",
  "soar",
  "upgrade",
];
const NEGATIVE_LEX: string[] = [
  "crash",
  "hack",
  "exploit",
  "ban",
  "lawsuit",
  "fraud",
  "bearish",
  "plunge",
  "selloff",
  "warning",
  "collapse",
];

const WEIGHT_SOURCE = 0.2;
const WEIGHT_RECENCY = 0.15;
const WEIGHT_FREQUENCY = 0.2;
const WEIGHT_IMPACT = 0.2;
const WEIGHT_ASSET = 0.15;
const WEIGHT_SENTIMENT = 0.1;

// ---------------------------------------------------------------------------
// Text / clustering
// ---------------------------------------------------------------------------

const STOP = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "was",
  "one",
  "our",
  "out",
  "new",
  "now",
  "how",
  "may",
  "its",
  "who",
  "has",
  "had",
  "this",
  "that",
  "with",
  "from",
  "will",
]);

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): Set<string> {
  const words = normalizeText(text).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
  return new Set(words);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function articleTokens(a: ArticleInput): Set<string> {
  const snippet = a.content.slice(0, 800);
  const combined = `${a.title}\n${snippet}`;
  return tokenize(combined);
}

function clusterArticles(articles: ArticleInput[], threshold: number): ArticleInput[][] {
  const sorted = [...articles].sort((x, y) => getTime(y) - getTime(x));
  const clusters: ArticleInput[][] = [];
  const memories: Set<string>[] = [];

  for (const art of sorted) {
    const tokens = articleTokens(art);
    let bestIdx = -1;
    let bestSim = 0;
    for (let i = 0; i < memories.length; i++) {
      const sim = jaccard(tokens, memories[i]!);
      if (sim >= threshold && sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      clusters[bestIdx]!.push(art);
      memories[bestIdx] = unionTokens(memories[bestIdx]!, tokens);
    } else {
      clusters.push([art]);
      memories.push(new Set(tokens));
    }
  }
  return clusters;
}

function unionTokens(a: Set<string>, b: Set<string>): Set<string> {
  const u = new Set(a);
  for (const x of b) u.add(x);
  return u;
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

function getTime(a: ArticleInput): number {
  const d = a.publishedAt instanceof Date ? a.publishedAt : new Date(a.publishedAt);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

function hoursSince(ts: number, now: number): number {
  return Math.max(0, (now - ts) / 3_600_000);
}

/** Exponential recency in [0, 1]: higher = fresher */
function recencyComponent(publishedAt: number, now: number, halfLifeHours: number): number {
  if (halfLifeHours <= 0) return 1;
  const h = hoursSince(publishedAt, now);
  const lambda = Math.LN2 / halfLifeHours;
  return Math.exp(-lambda * h);
}

// ---------------------------------------------------------------------------
// Scoring components (each returns 0–1 before weights)
// ---------------------------------------------------------------------------

function normalizeSourceKey(s: string): string {
  return s.trim().toLowerCase();
}

function sourceAuthorityScore(source: string, map: Record<string, number>): number {
  const key = normalizeSourceKey(source);
  const v = map[key];
  if (typeof v === "number") return clamp01(v);
  for (const [k, val] of Object.entries(map)) {
    if (key.includes(k) || k.includes(key)) return clamp01(val);
  }
  return 0.4;
}

function clusterSourceScore(articles: ArticleInput[], map: Record<string, number>): number {
  if (articles.length === 0) return 0;
  const now = Date.now();
  let sum = 0;
  let w = 0;
  for (const a of articles) {
    const sa = sourceAuthorityScore(a.source, map);
    const r = recencyComponent(getTime(a), now, 6);
    const weight = 0.2 + 0.8 * r;
    sum += sa * weight;
    w += weight;
  }
  return w > 0 ? clamp01(sum / w) : 0;
}

function clusterRecencyScore(articles: ArticleInput[], now: number, halfLifeHours: number): number {
  if (articles.length === 0) return 0;
  let best = 0;
  for (const a of articles) {
    best = Math.max(best, recencyComponent(getTime(a), now, halfLifeHours));
  }
  return clamp01(best);
}

function frequencyScore(count: number, cap: number): number {
  if (cap <= 1) return count > 0 ? 1 : 0;
  return clamp01(Math.log(1 + count) / Math.log(1 + cap));
}

function keywordImpactForText(text: string): number {
  const h = ` ${normalizeText(text)} `;
  let raw = 0;
  for (const [kw, w] of IMPACT_KEYWORDS) {
    if (h.includes(kw)) raw += w;
  }
  return raw;
}

function clusterImpactScore(articles: ArticleInput[], cap: number): number {
  if (articles.length === 0) return 0;
  let best = 0;
  for (const a of articles) {
    const combined = `${a.title} ${a.content.slice(0, 1200)}`;
    best = Math.max(best, keywordImpactForText(combined));
  }
  return clamp01(best / cap);
}

function clusterAssetScore(articles: ArticleInput[], weights: Record<string, number>): number {
  let best = 0;
  let anyMention = false;
  for (const a of articles) {
    for (const raw of a.mentionedAssets ?? []) {
      anyMention = true;
      const sym = raw.trim().toUpperCase();
      const w = weights[sym] ?? 0.45;
      best = Math.max(best, w);
    }
  }
  if (!anyMention) return 0.35;
  return clamp01(best);
}

function sentimentStrength(text: string): number {
  const h = normalizeText(text);
  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE_LEX) if (h.includes(w)) pos += 1;
  for (const w of NEGATIVE_LEX) if (h.includes(w)) neg += 1;
  const total = pos + neg;
  if (total === 0) return 0.25;
  const polarity = Math.abs(pos - neg) / total;
  const magnitude = Math.min(1, total / 4);
  return clamp01(0.35 * polarity + 0.65 * magnitude);
}

function clusterSentimentScore(articles: ArticleInput[]): number {
  if (articles.length === 0) return 0;
  let best = 0;
  for (const a of articles) {
    const s = sentimentStrength(`${a.title} ${a.content.slice(0, 600)}`);
    best = Math.max(best, s);
  }
  return clamp01(best);
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

// ---------------------------------------------------------------------------
// Spike detection
// ---------------------------------------------------------------------------

function computeSpikeMultiplier(articles: ArticleInput[], nowMs: number, o: SpikeOptionsResolved): number {
  const { spikeRecentWindowMs, spikeBaselineWindowMs, spikeRatioThreshold, spikeMaxBoost } = o;
  const recentStart = nowMs - spikeRecentWindowMs;
  const baselineStart = nowMs - spikeRecentWindowMs - spikeBaselineWindowMs;

  let recent = 0;
  let baseline = 0;
  for (const a of articles) {
    const t = getTime(a);
    if (t >= recentStart && t <= nowMs) recent += 1;
    else if (t >= baselineStart && t < recentStart) baseline += 1;
  }

  const expectedInRecent = baseline * (spikeRecentWindowMs / spikeBaselineWindowMs);
  const floor = 0.75;
  const expected = Math.max(floor, expectedInRecent);

  const ratio = recent / expected;
  if (recent >= 2 && ratio >= spikeRatioThreshold) {
    const extra = Math.min(spikeMaxBoost, (ratio - spikeRatioThreshold) * 0.35);
    return 1 + extra;
  }
  if (recent >= 4 && baseline === 0) {
    return 1 + Math.min(spikeMaxBoost, spikeMaxBoost * 0.85);
  }
  return 1;
}

function resolveSpikeOptions(opts: RankerOptions): SpikeOptionsResolved {
  return {
    spikeRecentWindowMs: opts.spikeRecentWindowMs ?? 90 * 60 * 1000,
    spikeBaselineWindowMs: opts.spikeBaselineWindowMs ?? 6 * 3_600_000,
    spikeRatioThreshold: opts.spikeRatioThreshold ?? 1.6,
    spikeMaxBoost: opts.spikeMaxBoost ?? 0.22,
  };
}

// ---------------------------------------------------------------------------
// Topic id + headline
// ---------------------------------------------------------------------------

function stableArticleKey(a: ArticleInput): string {
  if (a.id) return a.id;
  return `${a.title}|${getTime(a)}|${normalizeSourceKey(a.source)}`;
}

function topicStableId(articles: ArticleInput[]): string {
  const keys = [...new Set(articles.map(stableArticleKey))].sort();
  return createHash("sha256").update(keys.join("||")).digest("hex").slice(0, 20);
}

function topicHeadline(articles: ArticleInput[]): string {
  const sorted = [...articles].sort((a, b) => getTime(b) - getTime(a));
  return sorted[0]?.title?.trim() || "Untitled topic";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const defaultOptions = (): Required<
  Pick<
    RankerOptions,
    | "topN"
    | "clusterThreshold"
    | "recencyHalfLifeHours"
    | "frequencyCap"
    | "keywordImpactCap"
  >
> => ({
  topN: 5,
  clusterThreshold: 0.28,
  recencyHalfLifeHours: 12,
  frequencyCap: 18,
  keywordImpactCap: 10,
});

/**
 * Rank clustered crypto news topics. Returns top N topics by composite score (0–100).
 */
export function rankCryptoNews(articles: ArticleInput[], opts: RankerOptions = {}): RankedTopic[] {
  const now = opts.now?.getTime() ?? Date.now();
  const defs = defaultOptions();
  const topN = opts.topN ?? defs.topN;
  const clusterThreshold = opts.clusterThreshold ?? defs.clusterThreshold;
  const halfLife = opts.recencyHalfLifeHours ?? defs.recencyHalfLifeHours;
  const freqCap = opts.frequencyCap ?? defs.frequencyCap;
  const impactCap = opts.keywordImpactCap ?? defs.keywordImpactCap;
  const sourceMap = { ...DEFAULT_SOURCE_AUTHORITY, ...opts.sourceAuthority };
  const assetMap = { ...DEFAULT_ASSET_WEIGHTS, ...opts.assetWeights };
  const spikeOpts = resolveSpikeOptions(opts);

  if (!articles.length) return [];

  const groups = clusterArticles(articles, clusterThreshold);
  const ranked: RankedTopic[] = [];

  for (const group of groups) {
    if (group.length === 0) continue;

    const sourceScore = clusterSourceScore(group, sourceMap);
    const recencySc = clusterRecencyScore(group, now, halfLife);
    const frequencySc = frequencyScore(group.length, freqCap);
    const impactSc = clusterImpactScore(group, impactCap);
    const assetSc = clusterAssetScore(group, assetMap);
    const sentimentSc = clusterSentimentScore(group);

    const base01 =
      sourceScore * WEIGHT_SOURCE +
      recencySc * WEIGHT_RECENCY +
      frequencySc * WEIGHT_FREQUENCY +
      impactSc * WEIGHT_IMPACT +
      assetSc * WEIGHT_ASSET +
      sentimentSc * WEIGHT_SENTIMENT;

    const spikeMult = computeSpikeMultiplier(group, now, spikeOpts);
    const score100 = clamp01(base01) * 100 * spikeMult;
    const finalScore = Math.min(100, Math.round(score100 * 100) / 100);

    ranked.push({
      id: topicStableId(group),
      headline: topicHeadline(group),
      articles: group,
      score: finalScore,
      spikeMultiplier: Math.round(spikeMult * 1000) / 1000,
      breakdown: {
        sourceScore: round4(sourceScore),
        recencyScore: round4(recencySc),
        frequencyScore: round4(frequencySc),
        impactScore: round4(impactSc),
        assetScore: round4(assetSc),
        sentimentScore: round4(sentimentSc),
        baseScoreBeforeSpike: round4(base01 * 100),
      },
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, topN);
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
