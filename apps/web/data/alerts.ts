export type SmartAlert = {
  id: string;
  type: "buy" | "sell" | "rotation";
  chain: "bitcoin" | "ethereum" | "solana";
  walletAddress: string;
  token: string;
  notionalUsd: number;
  timestampIso: string;
  message: string;
};

export const smartAlerts: SmartAlert[] = [
  {
    id: "a-001",
    type: "buy",
    chain: "ethereum",
    walletAddress: "0x8A2b4E216f0b7f25A517FE87d67fA7e8D13B6A4C",
    token: "ENA",
    notionalUsd: 2_840_000,
    timestampIso: "2026-03-19T15:15:00.000Z",
    message: "Smart wallet bought ENA after exchange inflow dip.",
  },
  {
    id: "a-002",
    type: "sell",
    chain: "solana",
    walletAddress: "7YF2WmAm4m9xWkS6W8Y3L9q2k9J2nqz9r9x6nK8Yp4mP",
    token: "JUP",
    notionalUsd: 1_290_000,
    timestampIso: "2026-03-19T15:02:00.000Z",
    message: "Whale exited 14% of JUP position into strength.",
  },
  {
    id: "a-003",
    type: "rotation",
    chain: "bitcoin",
    walletAddress: "bc1q9d0q6h0s7k4q2k6n8r4w4p8v6j4y2w9u9x4k0a",
    token: "BTC",
    notionalUsd: 5_100_000,
    timestampIso: "2026-03-19T14:49:00.000Z",
    message: "Fund rotated stablecoin reserves into BTC.",
  },
  {
    id: "a-004",
    type: "buy",
    chain: "solana",
    walletAddress: "2ix3U4Wzu8w8fL8w5dF3iFYs6RwwxS8qfCHxj2Qbb4Q2",
    token: "PYTH",
    notionalUsd: 860_000,
    timestampIso: "2026-03-19T14:31:00.000Z",
    message: "Market maker accumulated PYTH after funding reset.",
  },
  {
    id: "a-005",
    type: "sell",
    chain: "ethereum",
    walletAddress: "0x4B6Ff3D026E7A8082c88D6D276D8A4f6b37c18e1",
    token: "MKR",
    notionalUsd: 980_000,
    timestampIso: "2026-03-19T14:18:00.000Z",
    message: "Large address reduced MKR exposure by 9%.",
  },
];

