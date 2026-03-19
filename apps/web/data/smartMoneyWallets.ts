export type SmartMoneyWallet = {
  id: string;
  chain: "bitcoin" | "ethereum" | "solana";
  address: string;
  walletType: "fund" | "whale" | "market-maker" | "dao-treasury";
  score: number;
  balance: number | null; // native coin units
  txCount: number | null; // recent tx count within last 24h (service-defined)
  lastActivity: string | null; // ISO
  inflow24h: number | null; // native coin units
  outflow24h: number | null; // native coin units
};

export const smartMoneyWallets: SmartMoneyWallet[] = [
  {
    id: "btc-001",
    chain: "bitcoin",
    address: "1P5ZEDWTKTFGxQjZphgWPQUpe554WKDfHQ",
    walletType: "fund",
    score: 96,
    balance: null,
    txCount: null,
    lastActivity: null,
    inflow24h: null,
    outflow24h: null,
  },
  {
    id: "eth-001",
    chain: "ethereum",
    address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    walletType: "market-maker",
    score: 94,
    balance: null,
    txCount: null,
    lastActivity: null,
    inflow24h: null,
    outflow24h: null,
  },
  {
    id: "sol-001",
    chain: "solana",
    address: "7YF2WmAm4m9xWkS6W8Y3L9q2k9J2nqz9r9x6nK8Yp4mP",
    walletType: "whale",
    score: 92,
    balance: null,
    txCount: null,
    lastActivity: null,
    inflow24h: null,
    outflow24h: null,
  },
  {
    id: "btc-002",
    chain: "bitcoin",
    address: "3LYJfcfHPXYJreMsASk2jkn69LWEYKzexb",
    walletType: "whale",
    score: 86,
    balance: null,
    txCount: null,
    lastActivity: null,
    inflow24h: null,
    outflow24h: null,
  },
  {
    id: "eth-002",
    chain: "ethereum",
    address: "0x66f820a414680B5bcda5eeca5dea238543f42054",
    walletType: "fund",
    score: 90,
    balance: null,
    txCount: null,
    lastActivity: null,
    inflow24h: null,
    outflow24h: null,
  },
  {
    id: "sol-002",
    chain: "solana",
    address: "2ix3U4Wzu8w8fL8w5dF3iFYs6RwwxS8qfCHxj2Qbb4Q2",
    walletType: "market-maker",
    score: 88,
    balance: null,
    txCount: null,
    lastActivity: null,
    inflow24h: null,
    outflow24h: null,
  },
];

