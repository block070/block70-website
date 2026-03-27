import type { NewsArticleSummary } from "@/lib/api";

export type NarrativeClusterId = "etf" | "regulation" | "ai" | "defi";

export type SentimentLabel = "bullish" | "bearish" | "neutral";

export type EnrichedNewsArticle = {
  article: NewsArticleSummary;
  bullets: string[];
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
  impactScore: number;
  clusters: NarrativeClusterId[];
};

/** Future: replace with LLM enrichment when API key / route exists. */
export async function enrichWithLlm(_item: NewsArticleSummary): Promise<Partial<EnrichedNewsArticle> | null> {
  return null;
}

const STOPWORDS = new Set(
  [
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was", "one", "our", "out", "day", "get", "has",
    "him", "his", "how", "its", "may", "new", "now", "old", "see", "two", "who", "boy", "did", "its", "let", "put", "say",
    "she", "too", "use", "that", "this", "with", "have", "from", "they", "been", "into", "more", "than", "then", "them",
    "these", "some", "what", "when", "will", "your", "about", "after", "also", "back", "being", "could", "each", "first",
    "here", "just", "like", "long", "made", "make", "many", "most", "much", "only", "other", "over", "such", "their",
    "time", "very", "were", "would", "there", "where", "while", "which", "bitcoin", "crypto", "cryptocurrency", "blockchain",
    "said", "says", "according", "report", "news", "market", "markets", "token", "tokens", "digital", "asset", "assets",
    "hasn", "didn", "doesn", "won", "don", "isn", "wasn", "amp",
  ].map((w) => w.toLowerCase()),
);

const BULLISH = [
  "rally", "rallies", "surge", "surges", "gains", "gain", "bullish", "soar", "soars", "jump", "jumps", "rise", "rises",
  "rising", "breakthrough", "approval", "approved", "adoption", "inflow", "inflows", "upgrade", "upgrades", "optimism",
  "record", "high", "milestone", "growth", "expansion", "partnership", "win", "beats", "beat", "positive", "outperform",
];
const BEARISH = [
  "plunge", "plunges", "crash", "crashes", "bearish", "selloff", "sell-off", "hack", "hacked", "exploit", "exploited",
  "lawsuit", "sec charges", "crackdown", "ban", "banned", "warning", "warnings", "collapse", "fraud", "outflow", "outflows",
  "concern", "fears", "fear", "tumble", "tumbles", "slide", "slides", "drop", "drops", "losses", "negative", "investigation",
];

const CLUSTER_RULES: { id: NarrativeClusterId; patterns: RegExp[] }[] = [
  {
    id: "etf",
    patterns: [
      /\betf\b/i,
      /\bexchange[- ]traded\b/i,
      /\bspot\s+(?:bitcoin|btc|ethereum|eth)\b/i,
      /\bblackrock\b/i,
      /\bgrayscale\b/i,
      /\bark invest\b/i,
      /\b(?:in|out)flows?\s+(?:to|from)\s+etf\b/i,
    ],
  },
  {
    id: "regulation",
    patterns: [
      /\bsec\b/i,
      /\bcftc\b/i,
      /\bregulation\b/i,
      /\bregulatory\b/i,
      /\bcourt\b/i,
      /\blawsuit\b/i,
      /\bcongress\b/i,
      /\bsenate\b/i,
      /\bcompliance\b/i,
      /\bsanction\b/i,
      /\b(?:bill|act)\s+(?:on|for)\s+crypto\b/i,
    ],
  },
  {
    id: "ai",
    patterns: [
      /\bartificial intelligence\b/i,
      /\bopenai\b/i,
      /\bchatgpt\b/i,
      /\bllm\b/i,
      /\bmachine learning\b/i,
      /\bnvidia\b/i,
      /\b(?:ai|ml)[-\s]?(?:chip|model|inference)\b/i,
    ],
  },
  {
    id: "defi",
    patterns: [
      /\bdefi\b/i,
      /\bdex\b/i,
      /\bamm\b/i,
      /\buniswap\b/i,
      /\baave\b/i,
      /\bcurve\b/i,
      /\b(?:yield|lending)\s+protocol\b/i,
      /\bstables?\s*coin\b/i,
      /\bliquidity\s+(?:pool|mining)\b/i,
      /\bon[- ]chain\b/i,
    ],
  },
];

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function articleText(item: NewsArticleSummary): string {
  const parts = [
    item.title,
    item.summary ? stripHtml(item.summary) : "",
    item.body_text ? stripHtml(item.body_text) : "",
    ...(item.tags ?? []).join(" "),
  ];
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function sentenceSegments(item: NewsArticleSummary): string[] {
  const raw = item.summary ? stripHtml(item.summary) : "";
  const body = item.body_text ? stripHtml(item.body_text) : "";
  const corpus = raw.length >= 40 ? raw : raw + " " + body;
  const cleaned = corpus.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return [`Headline: ${item.title.slice(0, 140)}${item.title.length > 140 ? "…" : ""}`];
  }
  const chunks = cleaned
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
  if (chunks.length === 0) return [cleaned.slice(0, 220) + (cleaned.length > 220 ? "…" : "")];
  return chunks;
}

function clampBullet(s: string, max = 200): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function bulletPointsForNews(item: NewsArticleSummary): string[] {
  const segs = sentenceSegments(item);
  const fromText = segs.slice(0, 3).map((s) => clampBullet(s));
  if (fromText.length >= 3) return fromText;
  const tickers = (item.tickers ?? []).slice(0, 4).join(", ");
  const fill: string[] = [];
  if (fromText.length === 0) {
    fill.push(`Headline: ${clampBullet(item.title, 140)}`);
  }
  if (fromText.length + fill.length < 2) {
    fill.push(tickers ? `Tickers in frame: ${tickers}` : `Source: ${item.source}`);
  }
  if (fromText.length + fill.length < 3) {
    fill.push(`Markets watching: ${clampBullet(item.title, 120)}`);
  }
  return [...fromText, ...fill].slice(0, 3);
}

function lexiconScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const w of BULLISH) {
    if (lower.includes(w)) score += 12;
  }
  for (const w of BEARISH) {
    if (lower.includes(w)) score -= 12;
  }
  return Math.max(-100, Math.min(100, score));
}

function labelFromScore(score: number): SentimentLabel {
  if (score >= 15) return "bullish";
  if (score <= -15) return "bearish";
  return "neutral";
}

/** API sentiment is typically a float; treat small magnitudes as neutral / use lexicon. */
export function sentimentForNews(item: NewsArticleSummary): {
  sentimentScore: number;
  sentimentLabel: SentimentLabel;
} {
  const text = articleText(item);
  const lex = lexiconScore(text);
  const raw = item.sentiment ?? 0;
  let blended = lex;
  if (Math.abs(raw) > 0.02) {
    const normalized = Math.max(-100, Math.min(100, raw * 100));
    blended = blended * 0.45 + normalized * 0.55;
  }
  blended = Math.max(-100, Math.min(100, blended));
  return { sentimentScore: Math.round(blended), sentimentLabel: labelFromScore(blended) };
}

function numFromExplanation(ex: Record<string, unknown>, key: string): number {
  const v = ex[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/**
 * Impact 0–100: prefer homepage_score; else rank_explanation + source signals; else length/tag heuristic.
 */
export function narrativeImpactFromNews(item: NewsArticleSummary): number {
  if (item.homepage_score != null && !Number.isNaN(item.homepage_score)) {
    return Math.max(0, Math.min(100, Math.round(item.homepage_score)));
  }
  const ex = item.rank_explanation ?? {};
  const recency = numFromExplanation(ex, "recency");
  const relevance = numFromExplanation(ex, "relevance") || numFromExplanation(ex, "coin_relevance");
  const cross = numFromExplanation(ex, "cross_source");
  const authority = numFromExplanation(ex, "authority");
  const composite =
    0.28 * recency + 0.22 * relevance + 0.22 * cross + 0.18 * authority;
  if (recency > 0 || relevance > 0 || cross > 0) {
    const boosted = composite + (item.source_count ?? 1) * 3 + (item.tags?.length ?? 0) * 2;
    return Math.max(18, Math.min(100, Math.round(boosted)));
  }
  const base = item.title.length + (item.summary?.length ?? 0);
  const tagBoost = (item.tags?.length ?? 0) * 7;
  const n = 48 + (base % 37) + tagBoost;
  return Math.max(38, Math.min(94, n));
}

export function aiSummaryForNews(item: NewsArticleSummary): string {
  if (item.summary && item.summary.length > 20) {
    const s = stripHtml(item.summary).replace(/\s+/g, " ").trim();
    return s.length > 200 ? `${s.slice(0, 197)}…` : s;
  }
  return `Headline watch: ${item.title.slice(0, 120)}${item.title.length > 120 ? "…" : ""}`;
}

export function classifyNarrativeClusters(item: NewsArticleSummary): NarrativeClusterId[] {
  const text = articleText(item);
  const found = new Set<NarrativeClusterId>();
  for (const { id, patterns } of CLUSTER_RULES) {
    if (patterns.some((re) => re.test(text))) found.add(id);
  }
  return found.size ? [...found] : [];
}

function tokenizeForTrend(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ""))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

export type TrendingKeyword = { keyword: string; count: number };

export function trendingKeywordsFromArticles(
  items: NewsArticleSummary[],
  limit = 12,
): TrendingKeyword[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const blob = `${item.title} ${stripHtml(item.summary ?? "")}`;
    for (const tok of tokenizeForTrend(blob)) {
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2 || items.length < 8)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword, count]) => ({ keyword, count }));
}

export type SentimentTrendWindows = {
  recentAvg: number;
  priorAvg: number;
  delta: number;
  recentCount: number;
  priorCount: number;
};

const MS_12H = 12 * 60 * 60 * 1000;

export function sentimentTrendFromArticles(items: NewsArticleSummary[]): SentimentTrendWindows | null {
  const now = Date.now();
  const recentScores: number[] = [];
  const priorScores: number[] = [];
  for (const item of items) {
    if (!item.published_at) continue;
    const t = new Date(item.published_at).getTime();
    if (Number.isNaN(t)) continue;
    const age = now - t;
    if (age < 0 || age > MS_12H * 2) continue;
    const { sentimentScore } = sentimentForNews(item);
    if (age <= MS_12H) recentScores.push(sentimentScore);
    else priorScores.push(sentimentScore);
  }
  if (recentScores.length === 0 && priorScores.length === 0) return null;
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const recentAvg = avg(recentScores);
  const priorAvg = avg(priorScores);
  return {
    recentAvg: Math.round(recentAvg * 10) / 10,
    priorAvg: Math.round(priorAvg * 10) / 10,
    delta: Math.round((recentAvg - priorAvg) * 10) / 10,
    recentCount: recentScores.length,
    priorCount: priorScores.length,
  };
}

function recencyRank(item: NewsArticleSummary): number {
  if (!item.published_at) return 0;
  const t = new Date(item.published_at).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function impactScoreForNews(item: NewsArticleSummary): number {
  return narrativeImpactFromNews(item);
}

export function enrichNewsArticle(item: NewsArticleSummary): EnrichedNewsArticle {
  const { sentimentScore, sentimentLabel } = sentimentForNews(item);
  const impactScore = impactScoreForNews(item);
  const clusters = classifyNarrativeClusters(item);
  return {
    article: item,
    bullets: bulletPointsForNews(item),
    sentimentScore,
    sentimentLabel,
    impactScore,
    clusters,
  };
}

export function rankArticlesForWhatMatters(enriched: EnrichedNewsArticle[]): EnrichedNewsArticle[] {
  return [...enriched].sort((a, b) => {
    if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore;
    const hs = (b.article.homepage_score ?? -1) - (a.article.homepage_score ?? -1);
    if (hs !== 0) return hs;
    const sc = (b.article.source_count ?? 1) - (a.article.source_count ?? 1);
    if (sc !== 0) return sc;
    return recencyRank(b.article) - recencyRank(a.article);
  });
}
