import type { PublishedArticleRow } from "@/lib/server/published-articles";
import type {
  HourEntities,
  HourIntelligencePayload,
  HourSummaries,
  IntelKeyword,
  MarketImpact,
  MarketImpactLabel,
  TopicCategoryId,
  WhatChanged,
} from "@/lib/crypto-hour-intelligence-types";

const TOP50 = new Set([
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "BNB",
  "DOGE",
  "ADA",
  "AVAX",
  "DOT",
  "LINK",
  "MATIC",
  "POL",
  "POLYGON",
  "SHIB",
  "LTC",
  "BCH",
  "ATOM",
  "NEAR",
  "APT",
  "ARB",
  "OP",
  "SUI",
  "SEI",
  "TIA",
  "INJ",
  "RUNE",
  "FIL",
  "ETC",
  "HBAR",
  "VET",
  "ICP",
  "ALGO",
  "FTM",
  "EGLD",
  "SAND",
  "MANA",
  "AXS",
  "CRO",
  "QNT",
  "FLOW",
  "EOS",
  "XLM",
  "AAVE",
  "MKR",
  "CRV",
  "SNX",
  "COMP",
  "LDO",
  "UNI",
  "PEPE",
]);

const POS = new Set([
  "surge",
  "rally",
  "gain",
  "gains",
  "soar",
  "rise",
  "risen",
  "rise",
  "bull",
  "bullish",
  "breakout",
  "record",
  "high",
  "adoption",
  "approve",
  "approved",
  "growth",
  "recover",
  "rebound",
  "upside",
]);

const NEG = new Set([
  "crash",
  "plunge",
  "drop",
  "slump",
  "hack",
  "exploit",
  "fraud",
  "sec",
  "lawsuit",
  "ban",
  "bear",
  "bearish",
  "fear",
  "outflow",
  "selloff",
  "default",
  "collapse",
  "volatile",
]);

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "from",
  "this",
  "are",
  "was",
  "has",
  "have",
  "not",
  "but",
  "its",
  "can",
  "will",
  "into",
  "over",
  "more",
  "than",
  "also",
  "what",
  "when",
  "who",
  "how",
  "about",
  "after",
  "before",
  "being",
  "been",
  "their",
  "they",
  "said",
  "say",
  "just",
  "our",
  "you",
  "all",
  "any",
  "new",
  "may",
  "now",
  "out",
  "per",
  "her",
  "him",
]);

const CAT_RULES: { id: TopicCategoryId; words: string[] }[] = [
  { id: "etf", words: ["etf", "spot etf", "blackrock", "ishares"] },
  { id: "regulation", words: ["sec", "regulation", "regulatory", "court", "lawsuit", "bill", "cftc"] },
  { id: "hack", words: ["hack", "exploit", "breach", "drain", "stolen", "phishing"] },
  { id: "defi", words: ["defi", "dex", "liquidity", "stake", "staking", "yield", "amm"] },
  { id: "ai", words: ["ai", "artificial intelligence", "model", "openai"] },
  { id: "macro", words: ["fed", "rate", "inflation", "gdp", "economy", "treasury", "dollar", "macro"] },
  { id: "listing", words: ["listing", "list", "binance", "coinbase", "delist"] },
];

function stripMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_\-]/g, " ");
}

function tokenize(text: string): string[] {
  return stripMarkdown(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

function docSentimentScore(tokens: string[]): number {
  let pos = 0;
  let neg = 0;
  for (const t of tokens) {
    if (POS.has(t)) pos++;
    if (NEG.has(t)) neg++;
  }
  const d = pos + neg;
  if (d === 0) return 0;
  return Math.max(-100, Math.min(100, ((pos - neg) / d) * 100));
}

function termSentiment(tokens: string[], term: string): number {
  const ix = tokens
    .map((w, i) => (w === term ? i : -1))
    .filter((i) => i >= 0);
  if (ix.length === 0) return 0;
  let adj = 0;
  for (const i of ix) {
    for (let j = Math.max(0, i - 3); j <= Math.min(tokens.length - 1, i + 3); j++) {
      if (POS.has(tokens[j]!)) adj++;
      if (NEG.has(tokens[j]!)) adj--;
    }
  }
  return Math.max(-100, Math.min(100, adj * 12));
}

function detectCategoryFromText(low: string): TopicCategoryId {
  for (const { id, words } of CAT_RULES) {
    if (words.some((w) => low.includes(w))) return id;
  }
  return "general";
}

function extractCoins(text: string): string[] {
  const u = text.toUpperCase();
  const found = new Set<string>();
  for (const sym of TOP50) {
    const re = new RegExp(`\\b${sym}\\b`, "i");
    if (re.test(u)) found.add(sym);
  }
  if (/\bBITCOIN\b/.test(u)) found.add("BTC");
  if (/\bETHEREUM\b/.test(u)) found.add("ETH");
  if (/\bSOLANA\b/.test(u)) found.add("SOL");
  return [...found].slice(0, 24);
}

function extractOrgLikeTitles(titles: string[]): string[] {
  const orgs = new Set<string>();
  for (const t of titles) {
    const caps = t.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g);
    if (caps) {
      for (const c of caps) {
        if (c.length > 3 && !["The", "This", "That", "When", "What", "From", "With"].includes(c))
          orgs.add(c);
      }
    }
  }
  return [...orgs].slice(0, 12);
}

function marketImpact(
  articleCount: number,
  topCoinHits: number,
  sentimentAbs: number,
): MarketImpact {
  const articlesN = Math.min(articleCount / 15, 1) * 40;
  const coinsN = Math.min(topCoinHits / 8, 1) * 30;
  const sentN = Math.min(sentimentAbs / 100, 1) * 20;
  const sourceCred = 0.78;
  const srcN = sourceCred * 10;
  const raw = articlesN + coinsN + sentN + srcN;
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  const label: MarketImpactLabel =
    score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  return {
    score,
    label,
    components: {
      articleVolume: Math.round(articlesN),
      topCoinMentions: Math.round(coinsN),
      sentimentIntensity: Math.round(sentN),
      sourceCredibility: Math.round(srcN),
    },
  };
}

function buildSummaries(
  articles: PublishedArticleRow[],
  keywords: IntelKeyword[],
  hourSent: number,
  cats: { id: TopicCategoryId; weight: number }[],
  entities: HourEntities,
): HourSummaries {
  const titles = articles.map((a) => a.title).filter(Boolean);
  const topk = keywords.slice(0, 5).map((k) => k.term);
  const cat = cats[0]?.id ?? "general";
  const quick = [
    topk.length
      ? `Trending terms: ${topk.join(", ")}.`
      : "Limited keyword signal this hour—watch the next batch.",
    `${articles.length} briefing${articles.length === 1 ? "" : "s"} in this hour’s window.`,
    `Tone skew: ${hourSent > 8 ? "constructive" : hourSent < -8 ? "defensive" : "balanced"} (${hourSent.toFixed(0)} sentiment).`,
  ];
  const deep = `This hour centers on ${cat.replace(/_/g, " ")}-leaning headlines. ${titles.slice(0, 3).join(" · ") || "Stories are still forming."} Key tickers and brands in focus include ${entities.coins.slice(0, 6).join(", ") || "no major symbols extracted yet"} and ${entities.organizations.slice(0, 4).join(", ") || "no firm names extracted yet"}. Read individual briefs for citations and nuance.`;
  const trader = `Flow read: ${hourSent > 5 ? "Risk-on headlines dominate—watch funding and perps for confirmation." : hourSent < -5 ? "Headline risk elevated—reduce size into illiquid names until tape stabilizes." : "Mixed tape narrative—trade levels, not stories."} Watch ${entities.coins.slice(0, 3).join(", ") || "majors"} for beta.`;
  const whale = `On-chain correlation is not wired yet—treat whale activity as a future signal. Showing narrative clusters only: ${topk.slice(0, 4).join(", ") || "n/a"}.`;
  return { quick, deep, trader, whale };
}

function diffWhatChanged(
  prev: PublishedArticleRow[] | null,
  curr: PublishedArticleRow[],
  currKeywords: IntelKeyword[],
  currSent: number,
  prevSent: number | null,
  currEntities: HourEntities,
  prevEntities: HourEntities | null,
): WhatChanged | null {
  if (!prev || !prev.length) return null;
  const pt = tokenize(prev.map((p) => `${p.title}\n${p.body_markdown}`).join("\n"));
  const freqPrev = new Map<string, number>();
  for (const t of pt) freqPrev.set(t, (freqPrev.get(t) ?? 0) + 1);
  const currTerms = new Set(currKeywords.map((k) => k.term));
  const prevTop = [...freqPrev.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([k]) => k);
  const prevSet = new Set(prevTop);
  const newKeywords = [...currTerms].filter((k) => !prevSet.has(k)).slice(0, 12);
  const droppedKeywords = [...prevSet].filter((k) => !currTerms.has(k)).slice(0, 12);
  const sentimentDelta = prevSent == null ? 0 : currSent - prevSent;
  const prevE = prevEntities ?? { coins: [], organizations: [], people: [] };
  const pe = new Set([...prevE.coins, ...prevE.organizations]);
  const ne = [...currEntities.coins, ...currEntities.organizations].filter((x) => !pe.has(x));
  return {
    newKeywords,
    droppedKeywords,
    sentimentDelta,
    newEntities: ne.slice(0, 12),
    categoryShifts: [],
  };
}

export function computeHourIntelligence(
  start: Date,
  end: Date,
  articles: PublishedArticleRow[],
  prevHourArticles: PublishedArticleRow[] | null,
  prevIntel: { avgSentiment: number; keywords: IntelKeyword[]; entities: HourEntities } | null,
): HourIntelligencePayload {
  const fullText = articles.map((a) => `${a.title}\n${a.body_markdown}`).join("\n");
  const tokens = tokenize(fullText);
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const keywords: IntelKeyword[] = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([term, count]) => {
      const low = fullText.toLowerCase();
      return {
        term,
        count,
        sentiment: termSentiment(tokens, term),
        categoryHint: detectCategoryFromText(`${term} ${low.slice(0, 2000)}`),
      };
    });

  const entities: HourEntities = {
    coins: extractCoins(fullText),
    organizations: extractOrgLikeTitles(articles.map((a) => a.title)),
    people: [],
  };

  const hourSentiment = docSentimentScore(tokens);
  const catFreq = new Map<TopicCategoryId, number>();
  for (const k of keywords.slice(0, 20)) {
    const c = k.categoryHint === "general" ? detectCategoryFromText(k.term) : k.categoryHint;
    catFreq.set(c, (catFreq.get(c) ?? 0) + k.count);
  }
  const catTotal = [...catFreq.values()].reduce((a, b) => a + b, 0) || 1;
  const categories = [...catFreq.entries()]
    .map(([id, w]) => ({ id, weight: w / catTotal }))
    .sort((a, b) => b.weight - a.weight);

  let topCoinHits = 0;
  for (const a of articles) topCoinHits += extractCoins(`${a.title}\n${a.body_markdown}`).length;
  const impact = marketImpact(articles.length, topCoinHits, Math.abs(hourSentiment));

  const prevSent = prevIntel?.avgSentiment ?? null;
  const whatChanged = diffWhatChanged(
    prevHourArticles,
    articles,
    keywords,
    hourSentiment,
    prevSent,
    entities,
    prevIntel?.entities ?? null,
  );

  const summaries = buildSummaries(articles, keywords, hourSentiment, categories, entities);

  return {
    version: 1,
    zone: "America/Chicago",
    hourStartIso: start.toISOString(),
    hourEndIso: end.toISOString(),
    keywords: keywords.slice(0, 30),
    entities,
    hourSentiment,
    categories,
    marketImpact: impact,
    whatChanged,
    summaries,
    articleCount: articles.length,
    articleIds: articles.map((a) => a.topic_id),
  };
}

/** Aggregate sentiment of a batch (for hour-over-hour). */
export function batchSentiment(articles: PublishedArticleRow[]): number {
  if (!articles.length) return 0;
  const t = tokenize(articles.map((a) => `${a.title}\n${a.body_markdown}`).join("\n"));
  return docSentimentScore(t);
}
