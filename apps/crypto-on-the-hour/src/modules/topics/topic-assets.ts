/**
 * Extract and persist mentioned_assets[] on topics from headlines + linked article titles.
 */
import { config } from "../../config.js";
import { query } from "../../db/pool.js";

/** Default: uppercase tickers / common names (crypto); override with MENTIONED_ASSETS_JSON. */
const DEFAULT_KNOWN_SYMBOLS = [
  "BTC",
  "BITCOIN",
  "ETH",
  "ETHEREUM",
  "SOL",
  "SOLANA",
  "BNB",
  "XRP",
  "DOGE",
  "ADA",
  "AVAX",
  "DOT",
  "MATIC",
  "POL",
  "LINK",
  "ATOM",
  "UNI",
  "LTC",
  "BCH",
  "SHIB",
  "PEPE",
  "APT",
  "ARB",
  "OP",
  "INJ",
  "TIA",
  "SUI",
  "SEI",
  "NEAR",
  "FTM",
  "ALGO",
  "XLM",
  "TRX",
  "TON",
  "USDT",
  "USDC",
  "DAI",
] as const;

const ALIASES_TO_CANONICAL: Record<string, string> = {
  BITCOIN: "BTC",
  ETHEREUM: "ETH",
  SOLANA: "SOL",
  POLYGON: "MATIC",
};

let knownSymbolsCache: string[] | null = null;

function getKnownSymbols(): string[] {
  if (knownSymbolsCache) return knownSymbolsCache;
  const raw = config.mentionedAssetsJson;
  if (raw) {
    try {
      const a = JSON.parse(raw) as unknown;
      if (Array.isArray(a)) {
        const out = a
          .filter((x): x is string => typeof x === "string" && x.trim() !== "")
          .map((x) => x.trim().toUpperCase());
        if (out.length) {
          knownSymbolsCache = out;
          return knownSymbolsCache;
        }
      }
    } catch {
      console.warn("[topic-assets] MENTIONED_ASSETS_JSON invalid; using built-in list");
    }
  }
  knownSymbolsCache = [...DEFAULT_KNOWN_SYMBOLS];
  return knownSymbolsCache;
}

/** Variants to match in SQL / API filter (canonical + aliases). */
export function expandSymbolForFilter(symbol: string): string[] {
  const u = symbol.trim().toUpperCase();
  const out = new Set<string>([u]);
  for (const [alias, canon] of Object.entries(ALIASES_TO_CANONICAL)) {
    if (canon === u) out.add(alias);
    if (alias === u) out.add(canon);
  }
  return [...out];
}

export function extractAssetsFromText(...chunks: string[]): string[] {
  const found = new Set<string>();
  const hay = chunks.join("\n");
  for (const sym of getKnownSymbols()) {
    const re = new RegExp(`\\b${sym}\\b`, "i");
    if (re.test(hay)) {
      found.add(ALIASES_TO_CANONICAL[sym] ?? sym);
    }
  }
  return [...found];
}

/**
 * After clustering, refresh assets for topics updated recently (cheap window).
 */
export async function refreshMentionedAssetsForRecentTopics(lookbackMinutes = 180): Promise<{ updated: number }> {
  const rows = await query<{ id: string; headline: string; titles: string[] | null }>(
    `SELECT t.id, t.headline, array_agg(ra.title ORDER BY ra.published_at DESC NULLS LAST) AS titles
     FROM topics t
     JOIN topic_articles ta ON ta.topic_id = t.id
     JOIN raw_articles ra ON ra.id = ta.article_id
     WHERE t.last_updated_at > now() - $1::int * interval '1 minute'
     GROUP BY t.id, t.headline`,
    [lookbackMinutes]
  );

  let updated = 0;
  for (const row of rows.rows) {
    const titles = row.titles ?? [];
    const assets = extractAssetsFromText(row.headline, ...titles);
    await query(`UPDATE topics SET mentioned_assets = $2::text[] WHERE id = $1`, [
      row.id,
      assets.length ? assets : "{}",
    ]);
    updated += 1;
  }
  return { updated };
}
