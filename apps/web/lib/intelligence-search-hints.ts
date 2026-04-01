/**
 * Client-side hints for AI Intelligence search UX.
 * Mirrors backend intent ordering in query_intent.py closely enough for previews (not authoritative).
 */

const NARRATIVE_SYMBOLS = [
  "FET",
  "TAO",
  "RNDR",
  "AGIX",
  "OCEAN",
  "WLD",
  "ARB",
  "OP",
  "STRK",
  "IMX",
  "MATIC",
  "POL",
  "DOGE",
  "PEPE",
  "SHIB",
  "WIF",
  "BONK",
  "FLOKI",
  "HNT",
  "FIL",
  "RENDER",
  "GRT",
  "AXS",
  "SAND",
  "MANA",
  "ONDO",
  "MKR",
  "LINK",
  "ETH",
  "SOL",
  "AVAX",
  "INJ",
] as const;

const COINGEKO_SLUG_MAP_SYMBOLS = [
  "BTC",
  "ETH",
  "USDT",
  "BNB",
  "USDC",
  "XRP",
  "SOL",
  "STETH",
  "ADA",
  "DOGE",
  "AVAX",
  "LINK",
  "TRX",
  "DOT",
  "BCH",
  "UNI",
  "MATIC",
  "SHIB",
  "LTC",
  "DAI",
  "XMR",
  "USDS",
  "WBTC",
  "FDUSD",
  "WETH",
  "LEO",
  "MNT",
  "TON",
  "TKX",
  "HYPE",
  "USD1",
  "EURC",
  "CRV",
  "GNO",
  "OP",
  "ARB",
  "PRIME",
  "GREAT",
  "SUN",
  "FET",
  "TAO",
  "AGIX",
  "RENDER",
  "IP",
  "IO",
  "2Z",
  "IOTA",
  "TUSD",
  "PAX",
  "GUSD",
] as const;

const EXTRA_MAJORS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOT", "ATOM", "LTC"] as const;

export const INTEL_SEARCH_PLACEHOLDER_EXAMPLES = [
  "ADA",
  "AI coins",
  "What will pump next",
  "Why is SOL going up",
] as const;

const KNOWN_TICKERS = new Set<string>([
  ...NARRATIVE_SYMBOLS,
  ...COINGEKO_SLUG_MAP_SYMBOLS,
  ...EXTRA_MAJORS,
]);

function tickersInQuery(q: string): Set<string> {
  const found = new Set<string>();
  const upper = q.toUpperCase();
  const re = /\b([A-Z]{2,6})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(upper)) !== null) {
    const t = m[1];
    if (KNOWN_TICKERS.has(t)) found.add(t);
  }
  return found;
}

function firstTokenUpper(raw: string): string | null {
  const parts = raw.trim().split(/\s+/);
  if (!parts.length) return null;
  const t = parts[0].toUpperCase().replace(/^\$+/, "");
  return t || null;
}

function sectorNarratives(qlow: string): Set<string> {
  const tags = new Set<string>();
  if (/\bai\b|artificial\s+intelligence|machine\s+learning|ai\s+coins?/.test(qlow)) tags.add("AI");
  if (/\bl2\b|layer\s*2|rollup|arbitrum|optimism|starknet/.test(qlow)) tags.add("L2");
  if (/\bmeme|doge|pepe|shib|bonk|wif|floki/.test(qlow)) tags.add("MEME");
  if (/\bdepin|de-pin|helium/.test(qlow)) tags.add("DEPIN");
  if (/\bgaming|gamefi|metaverse|axie/.test(qlow)) tags.add("GAMING");
  if (/\brwa|real\s+world|tokenized|ondo/.test(qlow)) tags.add("RWA");
  if (/\binfra|infrastructure|oracles?/.test(qlow)) tags.add("INFRA");
  return tags;
}

export type IntelSearchModeHint =
  | "coin_analysis"
  | "sector_scan"
  | "prediction_mode"
  | "defensive_scan"
  | "market_discovery";

const HINT_LABEL: Record<IntelSearchModeHint, string> = {
  coin_analysis: "Coin analysis",
  sector_scan: "Sector scan",
  prediction_mode: "Prediction mode",
  defensive_scan: "Defensive scan",
  market_discovery: "Market discovery",
};

export function getIntelSearchModeHintLabel(id: IntelSearchModeHint): string {
  return HINT_LABEL[id];
}

/** Infer mode hint from current draft query (while typing). */
export function inferIntelSearchModeHint(raw: string): IntelSearchModeHint | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const qlow = trimmed.toLowerCase();

  if (
    /\b(safe|safest|low\s*risk|should\s+i\s+sell|avoid\s+risk|capital\s*preservation|defensive)\b/.test(qlow)
  ) {
    return "defensive_scan";
  }

  if (
    /\b(what\s+will\s+pump|what\s+moves?\s+next|next\s+to\s+(pump|run)|about\s+to\s+move|early\s+runners?|before\s+it\s+moves)\b/.test(
      qlow,
    )
  ) {
    return "prediction_mode";
  }

  if (/why\s+(?:is\s+)?([a-z0-9]{2,8})\s+(?:pumping|up|moving|rallying|surging)/.test(qlow)) {
    return "coin_analysis";
  }

  const tickers = tickersInQuery(trimmed);
  const first = firstTokenUpper(trimmed);
  if (tickers.size === 1 && first) {
    const only = [...tickers][0];
    if (first === only) return "coin_analysis";
  }

  if (tickers.size >= 1 && /\b(vs|versus|compare|and)\b/.test(qlow) && tickers.size <= 4) {
    return "coin_analysis";
  }

  const sectorTags = sectorNarratives(qlow);
  if (
    sectorTags.size > 0 &&
    /\b(coins?|tokens?|sector|narrative|play|exposure|basket|names?)\b/.test(qlow)
  ) {
    return "sector_scan";
  }

  if (sectorTags.size > 0) {
    return "sector_scan";
  }

  return "market_discovery";
}
