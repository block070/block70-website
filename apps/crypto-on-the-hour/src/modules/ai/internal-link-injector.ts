/**
 * Post-process SEO markdown: coin deep links, Related Coins, Latest signals blocks.
 * Slugs align with Block70 web (apps/web/lib/coin-symbol-slugs.ts).
 * Fragment for “Latest signals” links follows PIPELINE_SLUG (default crypto-on-the-hour).
 */
import { config } from "../../config.js";

const SYMBOL_TO_SLUG: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  DOGE: "dogecoin",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  ATOM: "cosmos",
  UNI: "uniswap",
  LTC: "litecoin",
  TON: "toncoin",
  SHIB: "shiba-inu",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  USDT: "tether",
  USDC: "usd-coin",
};

type CoinRule = {
  symbol: string;
  slug: string;
  label: string;
  pattern: RegExp;
};

function buildCoinRules(): CoinRule[] {
  const rules: CoinRule[] = [
    { symbol: "BTC", slug: "bitcoin", label: "Bitcoin", pattern: /\b(Bitcoin|BTC)\b/gi },
    { symbol: "ETH", slug: "ethereum", label: "Ethereum", pattern: /\b(Ethereum|ETH)\b/gi },
    { symbol: "SOL", slug: "solana", label: "Solana", pattern: /\b(Solana|SOL)\b/gi },
    { symbol: "BNB", slug: "binancecoin", label: "BNB", pattern: /\b(BNB|Binance\s+Coin)\b/gi },
    { symbol: "XRP", slug: "ripple", label: "XRP", pattern: /\b(XRP|Ripple)\b/gi },
    { symbol: "DOGE", slug: "dogecoin", label: "Dogecoin", pattern: /\b(Dogecoin|DOGE)\b/gi },
    { symbol: "ADA", slug: "cardano", label: "Cardano", pattern: /\b(Cardano|ADA)\b/gi },
    { symbol: "AVAX", slug: "avalanche-2", label: "Avalanche", pattern: /\b(Avalanche|AVAX)\b/gi },
    { symbol: "DOT", slug: "polkadot", label: "Polkadot", pattern: /\b(Polkadot|DOT)\b/gi },
    { symbol: "MATIC", slug: "matic-network", label: "Polygon", pattern: /\b(Polygon|MATIC)\b/gi },
    { symbol: "LINK", slug: "chainlink", label: "Chainlink", pattern: /\b(Chainlink|LINK)\b/gi },
    { symbol: "ATOM", slug: "cosmos", label: "Cosmos", pattern: /\b(Cosmos|ATOM)\b/gi },
    { symbol: "UNI", slug: "uniswap", label: "Uniswap", pattern: /\b(Uniswap|UNI)\b/gi },
    { symbol: "LTC", slug: "litecoin", label: "Litecoin", pattern: /\b(Litecoin|LTC)\b/gi },
    { symbol: "TON", slug: "toncoin", label: "Toncoin", pattern: /\b(Toncoin|TON)\b/gi },
    { symbol: "SHIB", slug: "shiba-inu", label: "Shiba Inu", pattern: /\b(Shiba\s+Inu|SHIB)\b/gi },
    { symbol: "NEAR", slug: "near", label: "NEAR", pattern: /\b(NEAR\s+Protocol|NEAR)\b/gi },
    { symbol: "APT", slug: "aptos", label: "Aptos", pattern: /\b(Aptos|APT)\b/gi },
    { symbol: "ARB", slug: "arbitrum", label: "Arbitrum", pattern: /\b(Arbitrum|ARB)\b/gi },
    { symbol: "OP", slug: "optimism", label: "Optimism", pattern: /\b(Optimism|OP)\b/gi },
    { symbol: "USDT", slug: "tether", label: "USDT", pattern: /\b(USDT|Tether)\b/gi },
    { symbol: "USDC", slug: "usd-coin", label: "USDC", pattern: /\b(USDC|USD\s+Coin)\b/gi },
  ];
  return rules;
}

const COIN_RULES = buildCoinRules();

function protectMarkdownLinks(md: string): { text: string; links: string[] } {
  const links: string[] = [];
  const text = md.replace(/\[([^\]]*)\]\([^)]+\)/g, (m) => {
    links.push(m);
    return `§MDLINK${links.length - 1}§`;
  });
  return { text, links };
}

function restoreMarkdownLinks(text: string, links: string[]): string {
  return text.replace(/§MDLINK(\d+)§/g, (_, i) => links[Number(i)] ?? _);
}

function protectCodeFences(md: string): { text: string; blocks: string[] } {
  const blocks: string[] = [];
  const text = md.replace(/```[\s\S]*?```/g, (m) => {
    blocks.push(m);
    return `§CODE${blocks.length - 1}§`;
  });
  return { text, blocks };
}

function restoreCodeFences(text: string, blocks: string[]): string {
  return text.replace(/§CODE(\d+)§/g, (_, i) => blocks[Number(i)] ?? _);
}

/** First mention of each asset becomes an internal markdown link. */
export function injectCoinLinksInMarkdown(markdownBody: string): { text: string; symbolsLinked: string[] } {
  const codeProt = protectCodeFences(markdownBody);
  const { text: linkProtText, links } = protectMarkdownLinks(codeProt.text);
  let out = linkProtText;
  const symbolsLinked: string[] = [];

  for (const coin of COIN_RULES) {
    let replaced = false;
    const re = new RegExp(coin.pattern.source, coin.pattern.flags);
    out = out.replace(re, (match) => {
      if (replaced) return match;
      replaced = true;
      symbolsLinked.push(coin.symbol);
      return `[${coin.label}](/coins/${coin.slug})`;
    });
  }

  out = restoreMarkdownLinks(out, links);
  out = restoreCodeFences(out, codeProt.blocks);
  return { text: out, symbolsLinked };
}

export function normalizeSymbolList(assets: string[] | null | undefined): string[] {
  if (!assets?.length) return [];
  const out = new Set<string>();
  for (const a of assets) {
    const u = String(a).trim().toUpperCase();
    if (SYMBOL_TO_SLUG[u]) out.add(u);
  }
  return [...out];
}

export function buildRelatedCoinsSection(symbols: string[]): string {
  const uniq = [...new Set(symbols.map((s) => s.toUpperCase()))].filter((s) => SYMBOL_TO_SLUG[s]);
  if (!uniq.length) return "";

  const lines = uniq
    .sort()
    .map((sym) => {
      const slug = SYMBOL_TO_SLUG[sym] ?? sym.toLowerCase();
      const rule = COIN_RULES.find((r) => r.symbol === sym);
      const label = rule?.label ?? sym;
      return `- [${label} (${sym})](/coins/${slug})`;
    })
    .join("\n");

  return `\n\n## Related Coins\n\n${lines}\n`;
}

export function buildLatestSignalsSection(symbols: string[]): string {
  const uniq = [...new Set(symbols.map((s) => s.toUpperCase()))].filter((s) => SYMBOL_TO_SLUG[s]);
  if (!uniq.length) return "";

  const anchor = `#${config.pipelineSlug}`;

  if (uniq.length === 1) {
    const sym = uniq[0]!;
    const slug = SYMBOL_TO_SLUG[sym] ?? sym.toLowerCase();
    const rule = COIN_RULES.find((r) => r.symbol === sym);
    const label = rule?.label ?? sym;
    return `\n## Latest Signals for ${label}\n\nHourly clustered news and sentiment for **${label} (${sym})** are surfaced on the [${label} coin page](/coins/${slug}${anchor}). All analysis is informational, not financial advice.\n`;
  }

  const bullets = uniq
    .sort()
    .map((sym) => {
      const slug = SYMBOL_TO_SLUG[sym] ?? sym.toLowerCase();
      const rule = COIN_RULES.find((r) => r.symbol === sym);
      const label = rule?.label ?? sym;
      return `- **${label} (${sym})** — [Coin page & hourly signals](/coins/${slug}${anchor})`;
    })
    .join("\n");

  return `\n## Latest Signals\n\n${bullets}\n`;
}

/**
 * Split leading META: line from model output; return { metaLine, markdownRest }.
 */
export function splitMetaLine(fullText: string): { metaLine: string | null; markdownRest: string } {
  const trimmed = fullText.trimStart();
  if (trimmed.toUpperCase().startsWith("META:")) {
    const nl = trimmed.indexOf("\n");
    if (nl === -1) return { metaLine: trimmed, markdownRest: "" };
    return {
      metaLine: trimmed.slice(0, nl).trimEnd(),
      markdownRest: trimmed.slice(nl + 1).trimStart(),
    };
  }
  return { metaLine: null, markdownRest: fullText };
}

export function mergeMetaAndBody(metaLine: string | null, body: string): string {
  if (metaLine) return `${metaLine}\n\n${body.trimStart()}`;
  return body;
}

/**
 * Full pipeline: linkify body, append Related Coins + Latest Signals from union of linked + topic assets.
 */
export function enrichArticleMarkdown(
  rawModelOutput: string,
  topicMentionedAssets: string[] | null | undefined
): string {
  const { metaLine, markdownRest } = splitMetaLine(rawModelOutput);
  const { text: linked, symbolsLinked } = injectCoinLinksInMarkdown(markdownRest);
  const fromTopic = normalizeSymbolList(topicMentionedAssets);
  const allSymbols = [...new Set([...symbolsLinked, ...fromTopic])];

  let body = linked.trimEnd();
  body += buildRelatedCoinsSection(allSymbols);
  body += buildLatestSignalsSection(allSymbols);

  return mergeMetaAndBody(metaLine, body);
}
