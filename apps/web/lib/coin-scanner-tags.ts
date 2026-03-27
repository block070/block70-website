import type { Coin } from "@/lib/crypto-mock";

export type CoinScannerTags = {
  narrativeTags: string[];
  categoryTags: string[];
  signalTags: string[];
};

const NARRATIVE_RULES: { re: RegExp; tag: string }[] = [
  { re: /\b(ai|artificial|agi|compute|llm|agent)\b/i, tag: "AI" },
  { re: /\b(depin|sensor|wireless|helium)\b/i, tag: "DePIN" },
  { re: /\b(rwa|treasury|yield|bond|ondo)\b/i, tag: "RWA" },
  { re: /\b(defi|dex|amm|swap|lend|stake|vault)\b/i, tag: "DeFi" },
  { re: /\b(layer\s*2|l2|rollup|arb|op|op-stack|zk)\b/i, tag: "L2" },
  { re: /\b(layer\s*1|l1|smart[- ]contract chain)\b/i, tag: "L1" },
  { re: /\b(game|gaming|metaverse|play)\b/i, tag: "Gaming" },
  { re: /\b(meme|doge|pepe|shib)\b/i, tag: "Meme" },
];

const L1_SLUGS = new Set([
  "bitcoin",
  "ethereum",
  "solana",
  "binancecoin",
  "cardano",
  "avalanche-2",
  "polkadot",
  "tron",
  "cosmos",
  "near",
  "aptos",
  "sui",
  "celo",
]);

/** Same formula as computeBlock70Score (kept local to avoid circular imports with coins-scanner). */
function scoreForSignalTags(c: Coin): number {
  const p24 =
    typeof c.change24hPct === "number" && Number.isFinite(c.change24hPct) ? c.change24hPct : 0;
  const p7 =
    typeof c.change7dPct === "number" && Number.isFinite(c.change7dPct) ? c.change7dPct : 0;
  const vol = Math.max(0, c.volume24hUsd ?? 0);
  const mcap = Math.max(1, c.marketCapUsd ?? 1);
  const liquiditySignal = Math.min(18, Math.log10(vol / mcap + 1) * 9);
  const mom = p24 * 0.55 + p7 * 0.45;
  const momentumScaled = Math.min(42, Math.max(-42, mom * 1.35));
  const raw = 50 + momentumScaled * 0.82 + liquiditySignal * 0.45;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

function inferNarrativeTags(text: string): string[] {
  const found = new Set<string>();
  for (const { re, tag } of NARRATIVE_RULES) {
    if (re.test(text)) found.add(tag);
  }
  return [...found];
}

function signalTagsFromMetrics(change24h: number, volToMcap: number, score: number): string[] {
  const tags: string[] = [];
  if (volToMcap >= 0.12) tags.push("Volume spike");
  if (change24h >= 4) tags.push("Momentum");
  if (change24h <= -4) tags.push("Drawdown");
  if (score >= 74) tags.push("Smart-money lean");
  if (score <= 32) tags.push("Risk-off skew");
  if (tags.length === 0) tags.push("Balance");
  return tags.slice(0, 4);
}

function categoryTagsFromCoin(c: Coin): string[] {
  const out: string[] = [];
  if (c.categoryLabel) out.push(c.categoryLabel);
  if (c.scannerCategoryLabels?.length) {
    for (const x of c.scannerCategoryLabels) {
      if (x && !out.includes(x)) out.push(x);
    }
  }
  for (const id of c.categoryIds ?? []) {
    if (id && !out.includes(id)) out.push(id);
  }
  if (c.chainIds?.length) {
    for (const ch of c.chainIds) {
      if (ch && !out.includes(ch)) out.push(String(ch));
    }
  }
  if (L1_SLUGS.has(c.slug)) out.push("L1");
  return out.slice(0, 8);
}

/**
 * Infer narrative, category, and signal tags from a normalized Coin model.
 */
export function buildTags(c: Coin): CoinScannerTags {
  const categoryTags = categoryTagsFromCoin(c);
  const textBlob = `${c.name} ${c.symbol} ${categoryTags.join(" ")}`;
  let narrativeTags = inferNarrativeTags(textBlob);
  if (categoryTags.some((x) => /ai|big data/i.test(x)) && !narrativeTags.includes("AI")) {
    narrativeTags = [...narrativeTags, "AI"];
  }
  if (categoryTags.some((x) => /defi/i.test(x)) && !narrativeTags.includes("DeFi")) {
    narrativeTags = [...narrativeTags, "DeFi"];
  }
  if (
    categoryTags.some((x) => /layer|smart contract/i.test(x)) &&
    !narrativeTags.includes("L1")
  ) {
    narrativeTags = [...narrativeTags, "L1"];
  }
  narrativeTags = [...new Set(narrativeTags)].slice(0, 6);

  const mcap = Math.max(1, c.marketCapUsd ?? 1);
  const vol = c.volume24hUsd ?? 0;
  const volToMcap = vol / mcap;
  const p24 =
    typeof c.change24hPct === "number" && Number.isFinite(c.change24hPct) ? c.change24hPct : 0;
  const score = scoreForSignalTags(c);
  const signalTags = signalTagsFromMetrics(p24, volToMcap, score);

  return { narrativeTags, categoryTags, signalTags };
}

export { L1_SLUGS };
