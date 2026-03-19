export type SmartMoneyWallet = {
  id: string;
  chain: "bitcoin" | "ethereum" | "solana";
  address: string;
  walletType: "fund" | "whale" | "market-maker" | "dao-treasury";
  score: number;
  roi30d: number;
  roi90d: number;
  lastActivityIso: string;
  activityCount7d: number;
  holdingsUsd: number;
  topTokens: string[];
};

export const smartMoneyWallets: SmartMoneyWallet[] = [
  {
    id: "btc-001",
    chain: "bitcoin",
    address: "bc1q9d0q6h0s7k4q2k6n8r4w4p8v6j4y2w9u9x4k0a",
    walletType: "fund",
    score: 96,
    roi30d: 0.142,
    roi90d: 0.388,
    lastActivityIso: "2026-03-19T15:20:00.000Z",
    activityCount7d: 31,
    holdingsUsd: 182_400_000,
    topTokens: ["BTC", "WBTC", "USDC"],
  },
  {
    id: "eth-001",
    chain: "ethereum",
    address: "0x8A2b4E216f0b7f25A517FE87d67fA7e8D13B6A4C",
    walletType: "market-maker",
    score: 94,
    roi30d: 0.127,
    roi90d: 0.302,
    lastActivityIso: "2026-03-19T15:11:00.000Z",
    activityCount7d: 57,
    holdingsUsd: 129_900_000,
    topTokens: ["ETH", "ENA", "LDO"],
  },
  {
    id: "sol-001",
    chain: "solana",
    address: "7YF2WmAm4m9xWkS6W8Y3L9q2k9J2nqz9r9x6nK8Yp4mP",
    walletType: "whale",
    score: 92,
    roi30d: 0.168,
    roi90d: 0.421,
    lastActivityIso: "2026-03-19T15:03:00.000Z",
    activityCount7d: 43,
    holdingsUsd: 78_500_000,
    topTokens: ["SOL", "JUP", "PYTH"],
  },
  {
    id: "eth-002",
    chain: "ethereum",
    address: "0x4B6Ff3D026E7A8082c88D6D276D8A4f6b37c18e1",
    walletType: "fund",
    score: 90,
    roi30d: 0.098,
    roi90d: 0.247,
    lastActivityIso: "2026-03-19T14:52:00.000Z",
    activityCount7d: 24,
    holdingsUsd: 95_100_000,
    topTokens: ["ETH", "MKR", "AAVE"],
  },
  {
    id: "sol-002",
    chain: "solana",
    address: "2ix3U4Wzu8w8fL8w5dF3iFYs6RwwxS8qfCHxj2Qbb4Q2",
    walletType: "market-maker",
    score: 88,
    roi30d: 0.085,
    roi90d: 0.211,
    lastActivityIso: "2026-03-19T14:41:00.000Z",
    activityCount7d: 39,
    holdingsUsd: 61_300_000,
    topTokens: ["SOL", "BONK", "USDC"],
  },
  {
    id: "btc-002",
    chain: "bitcoin",
    address: "bc1q0l8v4r7s0u2a6j8m3t8f0x4y6c2u7h4l9e3n6t",
    walletType: "whale",
    score: 86,
    roi30d: 0.071,
    roi90d: 0.194,
    lastActivityIso: "2026-03-19T14:21:00.000Z",
    activityCount7d: 18,
    holdingsUsd: 55_800_000,
    topTokens: ["BTC", "USDT"],
  },
  {
    id: "eth-003",
    chain: "ethereum",
    address: "0xA271f58AA17fD6A2d8a9C8f4d4e3dEfA739ad18c",
    walletType: "dao-treasury",
    score: 83,
    roi30d: 0.064,
    roi90d: 0.175,
    lastActivityIso: "2026-03-19T13:58:00.000Z",
    activityCount7d: 15,
    holdingsUsd: 44_600_000,
    topTokens: ["ETH", "ARB", "OP"],
  },
  {
    id: "sol-003",
    chain: "solana",
    address: "6z4d7sK4p7pW5d4m3j5uW4r8m2v2eH4M3tW2u6gK9Q6A",
    walletType: "fund",
    score: 81,
    roi30d: 0.058,
    roi90d: 0.166,
    lastActivityIso: "2026-03-19T13:40:00.000Z",
    activityCount7d: 22,
    holdingsUsd: 37_200_000,
    topTokens: ["SOL", "JTO", "WIF"],
  },
];

