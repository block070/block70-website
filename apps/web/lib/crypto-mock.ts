export type Chain = {
  id: string;
  name: string;
  symbol: string;
  tvlUsd: number;
  marketCapUsd: number;
};

export type Category = {
  id: string;
  name: string;
  description: string;
  topCoins: string[];
  totalMarketCapUsd: number;
};

export type Exchange = {
  id: string;
  name: string;
  country?: string;
  volume24hUsd: number;
  markets: number;
};

export type Coin = {
  id: string;
  slug: string;
  symbol: string;
  name: string;
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  change24hPct: number;
  change7dPct: number;
  rank: number;
  categoryIds: string[];
  chainIds: string[];
  logoUrl?: string | null;
  /** Discover URL segment when known (CoinGecko category id) */
  categorySlug?: string | null;
  /** Human-readable category label */
  categoryLabel?: string | null;
  circulatingSupply?: number | null;
  totalSupply?: number | null;
};

export type PricePoint = {
  timestamp: string;
  priceUsd: number;
};

export const CHAINS: Chain[] = [
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    tvlUsd: 280_000_000_000,
    marketCapUsd: 310_000_000_000,
  },
  {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    tvlUsd: 16_000_000_000,
    marketCapUsd: 68_000_000_000,
  },
  {
    id: "base",
    name: "Base",
    symbol: "BASE",
    tvlUsd: 7_500_000_000,
    marketCapUsd: 0,
  },
];

export const CATEGORIES: Category[] = [
  {
    id: "defi",
    name: "DeFi Bluechips",
    description:
      "Protocols that sit at the core of on-chain liquidity and credit.",
    topCoins: ["uni", "aave", "crv"],
    totalMarketCapUsd: 25_000_000_000,
  },
  {
    id: "l1",
    name: "Layer 1s",
    description: "Base settlement layers competing for blockspace.",
    topCoins: ["eth", "sol", "avax"],
    totalMarketCapUsd: 450_000_000_000,
  },
  {
    id: "infra",
    name: "Infrastructure",
    description:
      "Oracles, bridges, and indexers that power higher-level protocols.",
    topCoins: ["link", "thegraph"],
    totalMarketCapUsd: 12_000_000_000,
  },
];

export const EXCHANGES: Exchange[] = [
  {
    id: "binance",
    name: "Binance",
    country: "Global",
    volume24hUsd: 18_000_000_000,
    markets: 400,
  },
  {
    id: "okx",
    name: "OKX",
    country: "Global",
    volume24hUsd: 6_500_000_000,
    markets: 250,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    country: "DEX · Solana",
    volume24hUsd: 1_800_000_000,
    markets: 5000,
  },
];

export const COINS: Coin[] = [
  {
    id: "bitcoin",
    slug: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    priceUsd: 70500,
    marketCapUsd: 1_400_000_000_000,
    volume24hUsd: 28_000_000_000,
    change24hPct: 1.2,
    change7dPct: 3.8,
    rank: 1,
    categoryIds: ["store-of-value"],
    categorySlug: "proof-of-work-pow",
    categoryLabel: "Proof of Work (PoW)",
    chainIds: [],
  },
  {
    id: "ethereum",
    slug: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    priceUsd: 3400,
    marketCapUsd: 310_000_000_000,
    volume24hUsd: 18_000_000_000,
    change24hPct: 0.9,
    change7dPct: 4.1,
    rank: 2,
    categoryIds: ["l1"],
    categorySlug: "layer-1",
    categoryLabel: "Layer 1 (L1)",
    chainIds: ["ethereum"],
  },
  {
    id: "solana",
    slug: "solana",
    symbol: "SOL",
    name: "Solana",
    priceUsd: 160,
    marketCapUsd: 68_000_000_000,
    volume24hUsd: 4_800_000_000,
    change24hPct: 3.2,
    change7dPct: 12.4,
    rank: 5,
    categoryIds: ["l1"],
    chainIds: ["solana"],
  },
  {
    id: "chainlink",
    slug: "chainlink",
    symbol: "LINK",
    name: "Chainlink",
    priceUsd: 19.5,
    marketCapUsd: 11_000_000_000,
    volume24hUsd: 620_000_000,
    change24hPct: -0.4,
    change7dPct: 5.2,
    rank: 20,
    categoryIds: ["infra"],
    chainIds: ["ethereum"],
  },
  {
    id: "avalanche",
    slug: "avalanche",
    symbol: "AVAX",
    name: "Avalanche",
    priceUsd: 38,
    marketCapUsd: 14_000_000_000,
    volume24hUsd: 380_000_000,
    change24hPct: 1.1,
    change7dPct: 6.0,
    rank: 12,
    categoryIds: ["l1"],
    chainIds: ["avalanche"],
  },
  {
    id: "dogecoin",
    slug: "dogecoin",
    symbol: "DOGE",
    name: "Dogecoin",
    priceUsd: 0.42,
    marketCapUsd: 60_000_000_000,
    volume24hUsd: 2_200_000_000,
    change24hPct: 2.0,
    change7dPct: 8.0,
    rank: 8,
    categoryIds: ["meme"],
    chainIds: [],
  },
  {
    id: "uniswap",
    slug: "uniswap",
    symbol: "UNI",
    name: "Uniswap",
    priceUsd: 12,
    marketCapUsd: 7_200_000_000,
    volume24hUsd: 450_000_000,
    change24hPct: 0.5,
    change7dPct: 4.0,
    rank: 22,
    categoryIds: ["defi"],
    chainIds: ["ethereum"],
  },
  {
    id: "cosmos",
    slug: "cosmos",
    symbol: "ATOM",
    name: "Cosmos",
    priceUsd: 9.2,
    marketCapUsd: 3_600_000_000,
    volume24hUsd: 180_000_000,
    change24hPct: -0.2,
    change7dPct: 3.0,
    rank: 28,
    categoryIds: ["l1"],
    chainIds: ["cosmos"],
  },
];

export const TRENDING_COINS: Coin[] = [
  COINS[2], // SOL
  COINS[3], // LINK
  COINS[1], // ETH
];

export const COIN_PRICES: Record<string, PricePoint[]> = {
  bitcoin: Array.from({ length: 24 }).map((_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
    priceUsd: 62000 + i * 40,
  })),
  ethereum: Array.from({ length: 24 }).map((_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
    priceUsd: 3200 + i * 10,
  })),
  solana: Array.from({ length: 24 }).map((_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
    priceUsd: 145 + i * 0.8,
  })),
  chainlink: Array.from({ length: 24 }).map((_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
    priceUsd: 18 + i * 0.05,
  })),
  avalanche: Array.from({ length: 24 }).map((_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
    priceUsd: 36 + i * 0.1,
  })),
  dogecoin: Array.from({ length: 24 }).map((_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
    priceUsd: 0.4 + i * 0.001,
  })),
  uniswap: Array.from({ length: 24 }).map((_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
    priceUsd: 11.5 + i * 0.02,
  })),
  cosmos: Array.from({ length: 24 }).map((_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
    priceUsd: 9 + i * 0.01,
  })),
};

