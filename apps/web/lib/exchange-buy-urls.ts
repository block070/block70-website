/**
 * Deep links to buy/trade flows (no affiliate params — add via env later if needed).
 */
export type ExchangeBuyLinks = {
  coinbase: string;
  binanceUs: string;
  kraken: string;
};

/** Binance.US pair: BASE_USD or BASE_USDT fallback */
export function getExchangeBuyUrls(symbol: string, slug: string): ExchangeBuyLinks {
  const base = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "BTC";
  const slugSafe = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "bitcoin";

  return {
    coinbase: `https://www.coinbase.com/price/${encodeURIComponent(slugSafe)}`,
    binanceUs: `https://www.binance.us/trade/${base}_USD`,
    kraken: `https://www.kraken.com/prices/${encodeURIComponent(slugSafe)}`,
  };
}
