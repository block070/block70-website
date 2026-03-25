/** Heuristic slug routes for internal coin links when only a symbol is known. */

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

export function coinHrefFromSymbol(symbol: string): string {
  const u = symbol.trim().toUpperCase();
  const slug = SYMBOL_TO_SLUG[u] ?? symbol.trim().toLowerCase();
  return `/coins/${slug}`;
}
