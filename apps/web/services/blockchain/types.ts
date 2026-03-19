export type NormalizedWalletActivity = {
  address: string;
  chain: "bitcoin" | "ethereum" | "solana";
  balance: number | null;
  txCount: number | null;
  lastActivity: string | null; // ISO string
  inflow24h: number | null; // coin units
  outflow24h: number | null; // coin units
  fetchError: string | null;
};

