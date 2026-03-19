export type SmartToken = {
  id: string;
  symbol: string;
  name: string;
  chain: "bitcoin" | "ethereum" | "solana";
  smartWalletsAccumulating: number;
  smartWalletsExiting: number;
  netflowUsd24h: number;
  avgScoreExposure: number;
};

export const smartTokens: SmartToken[] = [
  {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    chain: "bitcoin",
    smartWalletsAccumulating: 42,
    smartWalletsExiting: 11,
    netflowUsd24h: 27_400_000,
    avgScoreExposure: 89,
  },
  {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    chain: "ethereum",
    smartWalletsAccumulating: 36,
    smartWalletsExiting: 14,
    netflowUsd24h: 18_200_000,
    avgScoreExposure: 87,
  },
  {
    id: "solana",
    symbol: "SOL",
    name: "Solana",
    chain: "solana",
    smartWalletsAccumulating: 29,
    smartWalletsExiting: 9,
    netflowUsd24h: 14_900_000,
    avgScoreExposure: 85,
  },
  {
    id: "ethena",
    symbol: "ENA",
    name: "Ethena",
    chain: "ethereum",
    smartWalletsAccumulating: 17,
    smartWalletsExiting: 3,
    netflowUsd24h: 6_700_000,
    avgScoreExposure: 82,
  },
  {
    id: "pyth-network",
    symbol: "PYTH",
    name: "Pyth Network",
    chain: "solana",
    smartWalletsAccumulating: 15,
    smartWalletsExiting: 5,
    netflowUsd24h: 4_100_000,
    avgScoreExposure: 80,
  },
];

