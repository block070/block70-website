import type { SmartMoneyWallet } from "@/data/smartMoneyWallets";
import { smartMoneyWallets } from "@/data/smartMoneyWallets";

export type SupportedWhaleChain = "bitcoin" | "ethereum" | "solana";

const CHAINS: SupportedWhaleChain[] = ["bitcoin", "ethereum", "solana"];

export function normalizeWhaleChain(param: string): SupportedWhaleChain | null {
  const c = param.toLowerCase();
  return CHAINS.includes(c as SupportedWhaleChain) ? (c as SupportedWhaleChain) : null;
}

export function findWhaleSeed(
  chain: SupportedWhaleChain,
  address: string,
): SmartMoneyWallet | undefined {
  return smartMoneyWallets.find(
    (w) => w.chain === chain && w.address.toLowerCase() === address.toLowerCase(),
  );
}

/** Explorer any address: merge curated seed metadata with synthetic row when unknown. */
export function resolveWhaleRow(
  chain: SupportedWhaleChain,
  address: string,
): SmartMoneyWallet {
  const seed = findWhaleSeed(chain, address);
  if (seed) return seed;
  return {
    id: `explore-${chain}-${address.slice(0, 8)}`,
    chain,
    address,
    walletType: "whale",
    score: 0,
    balance: null,
    txCount: null,
    lastActivity: null,
    inflow24h: null,
    outflow24h: null,
    fetchError: null,
  };
}
