/**
 * Block70 Developer API (/api/v1/dev) — single source for docs + Try-it allowlist.
 */

export type ApiDocPathParam = {
  name: string;
  description: string;
  example: string;
};

export type ApiDocQueryParam = {
  name: string;
  description: string;
  default?: string | number;
  example?: string | number;
};

export type ApiDocEndpoint = {
  id: string;
  category: string;
  categoryLabel: string;
  title: string;
  description: string;
  method: "GET";
  /** Path under /api/v1/dev, e.g. /signals or /signals/{token} */
  path: string;
  pathParams?: ApiDocPathParam[];
  queryParams?: ApiDocQueryParam[];
  /** Requires trading permission on API key */
  requiresTradingScope?: boolean;
  sampleResponse: unknown;
};

export const DEV_API_PREFIX = "/api/v1/dev";

export const API_DOC_ENDPOINTS: ApiDocEndpoint[] = [
  {
    id: "signals-list",
    category: "signals",
    categoryLabel: "Signals",
    title: "List signals",
    description:
      "Paginated list of signals with optional filters by chain, signal type, or token symbol/address.",
    method: "GET",
    path: "/signals",
    queryParams: [
      { name: "chain", description: "Filter by chain (e.g. ethereum, solana)", example: "ethereum" },
      { name: "signal_type", description: "Filter by signal type", example: "wallet" },
      { name: "token", description: "Symbol or contract address", example: "ETH" },
      { name: "limit", description: "Page size (1–500)", default: 100, example: 10 },
      { name: "offset", description: "Pagination offset", default: 0, example: 0 },
    ],
    sampleResponse: [
      {
        id: 1,
        token_symbol: "ETH",
        token_address: "0x…",
        chain: "ethereum",
        signal_type: "wallet",
        confidence_score: 0.82,
        signal_strength: 0.71,
        title: "Accumulation detected",
        created_at: "2026-01-15T12:00:00+00:00",
      },
    ],
  },
  {
    id: "signals-latest",
    category: "signals",
    categoryLabel: "Signals",
    title: "Latest signals",
    description: "Most recent signals, sorted by created_at descending.",
    method: "GET",
    path: "/signals/latest",
    queryParams: [{ name: "limit", description: "Max rows (1–200)", default: 50, example: 20 }],
    sampleResponse: [
      {
        id: 2,
        token_symbol: "BTC",
        signal_type: "radar",
        confidence_score: 0.75,
        created_at: "2026-01-15T11:00:00+00:00",
      },
    ],
  },
  {
    id: "signals-by-token",
    category: "signals",
    categoryLabel: "Signals",
    title: "Signals for token",
    description: "All signals matching a token symbol or address.",
    method: "GET",
    path: "/signals/{token}",
    pathParams: [
      { name: "token", description: "Token symbol or address", example: "ETH" },
    ],
    queryParams: [{ name: "limit", description: "Max rows (1–500)", default: 100, example: 50 }],
    sampleResponse: [
      {
        id: 3,
        token_symbol: "ETH",
        signal_type: "wallet",
        confidence_score: 0.8,
        created_at: "2026-01-15T10:00:00+00:00",
      },
    ],
  },
  {
    id: "wallets-list",
    category: "wallets",
    categoryLabel: "Wallets",
    title: "Wallet leaderboard",
    description: "Smart wallets ordered by average ROI.",
    method: "GET",
    path: "/wallets",
    queryParams: [{ name: "limit", description: "Max rows (1–500)", default: 100, example: 25 }],
    sampleResponse: [
      {
        wallet_address: "0xabc…",
        win_rate: 0.62,
        average_roi: 12.4,
        total_profit_usd: 50000,
      },
    ],
  },
  {
    id: "wallets-detail",
    category: "wallets",
    categoryLabel: "Wallets",
    title: "Wallet profile",
    description: "Single wallet profile by address.",
    method: "GET",
    path: "/wallets/{address}",
    pathParams: [
      { name: "address", description: "Wallet address", example: "0x1234567890123456789012345678901234567890" },
    ],
    sampleResponse: {
      wallet_address: "0x1234…",
      win_rate: 0.55,
      average_roi: 8.2,
      total_profit_usd: 12000,
    },
  },
  {
    id: "wallets-transactions",
    category: "wallets",
    categoryLabel: "Wallets",
    title: "Wallet activity",
    description: "Recent wallet-type opportunities linked to the address.",
    method: "GET",
    path: "/wallets/{address}/transactions",
    pathParams: [
      { name: "address", description: "Wallet address", example: "0x1234567890123456789012345678901234567890" },
    ],
    queryParams: [{ name: "limit", description: "Max rows (1–200)", default: 50, example: 20 }],
    sampleResponse: [
      {
        id: 10,
        title: "Whale rotation",
        type: "wallet",
        asset_symbol: "0x1234…",
        total_score: 88.5,
        detected_at: "2026-01-14T09:00:00+00:00",
      },
    ],
  },
  {
    id: "opportunities-list",
    category: "opportunities",
    categoryLabel: "Opportunities",
    title: "List opportunities",
    description: "Active opportunities ranked by total score.",
    method: "GET",
    path: "/opportunities",
    queryParams: [
      { name: "type", description: "Opportunity type", example: "arbitrage" },
      { name: "chain", description: "Chain filter", example: "ethereum" },
      { name: "limit", description: "Max rows (1–500)", default: 100, example: 20 },
    ],
    sampleResponse: [
      {
        id: 100,
        title: "Cross-DEX arb",
        type: "arbitrage",
        chain: "ethereum",
        total_score: 92.0,
        status: "active",
      },
    ],
  },
  {
    id: "opportunities-detail",
    category: "opportunities",
    categoryLabel: "Opportunities",
    title: "Get opportunity",
    description: "Single opportunity by numeric ID.",
    method: "GET",
    path: "/opportunities/{id}",
    pathParams: [{ name: "id", description: "Opportunity ID", example: "100" }],
    sampleResponse: {
      id: 100,
      title: "Cross-DEX arb",
      type: "arbitrage",
      status: "active",
      total_score: 92.0,
    },
  },
  {
    id: "market-prices",
    category: "market",
    categoryLabel: "Market",
    title: "Market prices",
    description: "Recent price snapshots joined with coin metadata (deduped by coin).",
    method: "GET",
    path: "/market/prices",
    queryParams: [{ name: "limit", description: "Max rows (1–500)", default: 100, example: 10 }],
    sampleResponse: [
      {
        symbol: "BTC",
        price: 97500.12,
        market_cap: 1.9e12,
        volume_24h: 2.5e10,
        price_change_24h: 1.2,
        timestamp: "2026-01-15T12:00:00+00:00",
      },
    ],
  },
  {
    id: "market-trending",
    category: "market",
    categoryLabel: "Market",
    title: "Trending tokens",
    description: "Tokens with strongest signal clusters over the last 24h.",
    method: "GET",
    path: "/market/trending",
    queryParams: [{ name: "limit", description: "Max rows (1–100)", default: 20, example: 10 }],
    sampleResponse: [
      {
        token_symbol: "PEPE",
        token_address: "0x…",
        chain: "ethereum",
        signal_count: 14,
        avg_confidence_score: 0.77,
      },
    ],
  },
  {
    id: "market-gainers",
    category: "market",
    categoryLabel: "Market",
    title: "Top gainers",
    description: "Largest positive 24h price changes.",
    method: "GET",
    path: "/market/gainers",
    queryParams: [{ name: "limit", description: "Max rows (1–100)", default: 20, example: 10 }],
    sampleResponse: [{ symbol: "XYZ", price: 0.42, price_change_24h: 18.5 }],
  },
  {
    id: "market-losers",
    category: "market",
    categoryLabel: "Market",
    title: "Top losers",
    description: "Largest negative 24h price changes.",
    method: "GET",
    path: "/market/losers",
    queryParams: [{ name: "limit", description: "Max rows (1–100)", default: 20, example: 10 }],
    sampleResponse: [{ symbol: "ABC", price: 1.05, price_change_24h: -9.2 }],
  },
  {
    id: "airdrops-list",
    category: "airdrops",
    categoryLabel: "Airdrops",
    title: "List airdrops",
    description: "Active airdrop opportunities.",
    method: "GET",
    path: "/airdrops",
    sampleResponse: [{ id: 200, title: "LayerZero drop", type: "airdrop", total_score: 80 }],
  },
  {
    id: "airdrops-upcoming",
    category: "airdrops",
    categoryLabel: "Airdrops",
    title: "Upcoming airdrops",
    description: "Recently created airdrop opportunities.",
    method: "GET",
    path: "/airdrops/upcoming",
    queryParams: [{ name: "limit", description: "Max rows (1–100)", default: 20, example: 10 }],
    sampleResponse: [{ id: 201, title: "Protocol X", type: "airdrop" }],
  },
  {
    id: "airdrops-active",
    category: "airdrops",
    categoryLabel: "Airdrops",
    title: "Active airdrops",
    description: "Active airdrops sorted by score.",
    method: "GET",
    path: "/airdrops/active",
    sampleResponse: [{ id: 200, title: "LayerZero drop", type: "airdrop" }],
  },
  {
    id: "strategies-list",
    category: "strategies",
    categoryLabel: "Strategies",
    title: "Your strategies",
    description: "Trading strategies owned by the API key’s user.",
    method: "GET",
    path: "/strategies",
    requiresTradingScope: true,
    sampleResponse: [
      {
        id: 1,
        strategy_name: "Momentum",
        description: "High-confidence signals",
        is_public: false,
        created_at: "2026-01-01T00:00:00+00:00",
      },
    ],
  },
  {
    id: "strategies-backtests",
    category: "strategies",
    categoryLabel: "Strategies",
    title: "Strategy backtests",
    description: "Recent backtest rows for your strategies.",
    method: "GET",
    path: "/strategies/backtests",
    requiresTradingScope: true,
    sampleResponse: [
      {
        strategy_id: 1,
        strategy_name: "Momentum",
        total_trades: 12,
        win_rate: 0.58,
        average_profit: 2.1,
        max_drawdown: 4.2,
        created_at: "2026-01-10T00:00:00+00:00",
      },
    ],
  },
  {
    id: "strategies-detail",
    category: "strategies",
    categoryLabel: "Strategies",
    title: "Get strategy",
    description: "Full strategy detail for an ID you own.",
    method: "GET",
    path: "/strategies/{id}",
    pathParams: [{ name: "id", description: "Strategy ID", example: "1" }],
    requiresTradingScope: true,
    sampleResponse: {
      id: 1,
      strategy_name: "Momentum",
      description: "…",
      entry_rules: null,
      exit_rules: null,
      is_public: false,
      created_at: "2026-01-01T00:00:00+00:00",
    },
  },
  {
    id: "portfolio-root",
    category: "portfolio",
    categoryLabel: "Portfolio",
    title: "Portfolio summary",
    description: "Primary portfolio for the authenticated user.",
    method: "GET",
    path: "/portfolio",
    requiresTradingScope: true,
    sampleResponse: {
      portfolio: {
        id: 1,
        user_id: 42,
        total_value_usd: 10000,
      },
    },
  },
  {
    id: "portfolio-tokens",
    category: "portfolio",
    categoryLabel: "Portfolio",
    title: "Portfolio holdings",
    description: "Token balances in the user portfolio.",
    method: "GET",
    path: "/portfolio/tokens",
    requiresTradingScope: true,
    sampleResponse: [],
  },
  {
    id: "portfolio-performance",
    category: "portfolio",
    categoryLabel: "Portfolio",
    title: "Portfolio performance",
    description: "Aggregated performance and value metrics.",
    method: "GET",
    path: "/portfolio/performance",
    requiresTradingScope: true,
    sampleResponse: {
      total_value_usd: 10000,
      total_profit_loss: 450.25,
    },
  },
];

export function getEndpointById(id: string): ApiDocEndpoint | undefined {
  return API_DOC_ENDPOINTS.find((e) => e.id === id);
}

/** Build /api/v1/dev/... path with path params substituted */
export function buildDevPath(
  ep: ApiDocEndpoint,
  pathParams: Record<string, string>
): string {
  let p = ep.path;
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ep.path)) !== null) {
    const name = m[1];
    const val = pathParams[name] ?? "";
    p = p.replace(`{${name}}`, encodeURIComponent(val));
  }
  return `${DEV_API_PREFIX}${p}`;
}

export function buildQueryString(query: Record<string, string>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== "" && v !== undefined) u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

/** Categories in display order */
export const API_DOC_CATEGORY_ORDER: { id: string; label: string }[] = [
  { id: "signals", label: "Signals" },
  { id: "wallets", label: "Wallets" },
  { id: "opportunities", label: "Opportunities" },
  { id: "market", label: "Market" },
  { id: "airdrops", label: "Airdrops" },
  { id: "strategies", label: "Strategies" },
  { id: "portfolio", label: "Portfolio" },
];
