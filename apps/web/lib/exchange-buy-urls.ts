/**
 * Deep links to buy/trade flows. Defaults are built here; admin-configured
 * `url_template` values from the API override them when present (see
 * `/api/v1/exchange-affiliate-links`).
 *
 * Templates may include placeholders: {slug}, {symbol}, {base}
 * ({base} = uppercase alphanumeric ticker for paths like BINANCE_USD).
 */
export type ExchangeBuyLinks = {
  coinbase: string;
  binanceUs: string;
  kraken: string;
};

/** Backend / database keys → camelCase link field on ExchangeBuyLinks */
export const AFFILIATE_PROVIDER_KEYS = {
  coinbase: "coinbase",
  binance_us: "binanceUs",
  kraken: "kraken",
} as const;

function defaultBuyUrls(symbol: string, slug: string): ExchangeBuyLinks {
  const base = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "BTC";
  const slugSafe = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "bitcoin";

  return {
    coinbase: `https://www.coinbase.com/price/${encodeURIComponent(slugSafe)}`,
    binanceUs: `https://www.binance.us/trade/${base}_USD`,
    kraken: `https://www.kraken.com/prices/${encodeURIComponent(slugSafe)}`,
  };
}

/** Expand admin template; pass raw slug/symbol fragments safe for paths. */
export function applyExchangeAffiliateTemplate(
  template: string,
  symbol: string,
  slug: string
): string {
  const base = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "BTC";
  const slugSafe = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "bitcoin";
  let out = template
    .replaceAll("{base}", base)
    .replaceAll("{symbol}", base)
    .replaceAll("{slug}", slugSafe);
  if (out.includes("{slugEncoded}")) {
    out = out.replaceAll("{slugEncoded}", encodeURIComponent(slugSafe));
  }
  if (out.includes("{symbolEncoded}")) {
    out = out.replaceAll("{symbolEncoded}", encodeURIComponent(base));
  }
  return out;
}

/**
 * When `templates` is from GET /api/v1/exchange-affiliate-links, non-empty
 * keys override built-in URLs for that venue.
 */
export function getExchangeBuyUrls(
  symbol: string,
  slug: string,
  templates?: Record<string, string> | null
): ExchangeBuyLinks {
  const defaults = defaultBuyUrls(symbol, slug);
  if (!templates || !Object.keys(templates).length) return defaults;

  const pick = (key: keyof typeof AFFILIATE_PROVIDER_KEYS, fallback: string) => {
    const raw = templates[key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      return applyExchangeAffiliateTemplate(raw.trim(), symbol, slug);
    }
    return fallback;
  };

  return {
    coinbase: pick("coinbase", defaults.coinbase),
    binanceUs: pick("binance_us", defaults.binanceUs),
    kraken: pick("kraken", defaults.kraken),
  };
}
