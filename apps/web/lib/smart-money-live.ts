import { getBtcWalletActivity } from "@/services/blockchain/btc.service";
import { getEthWalletActivity } from "@/services/blockchain/eth.service";
import { getSolWalletActivity } from "@/services/blockchain/sol.service";
import { smartMoneyWallets, type SmartMoneyWallet } from "@/data/smartMoneyWallets";
import type { NormalizedWalletActivity } from "@/services/blockchain/types";

const INVALID_SOL_PREFIXES = [
  "Sysvar",
  "Vote",
  "Stake",
  "Config",
  "111111111111111111111111111111111111",
];

function isInvalidSolanaAddress(address: string): boolean {
  return INVALID_SOL_PREFIXES.some((p) => address.startsWith(p));
}

function solWalletPassesFilters(wallet: SmartMoneyWallet): boolean {
  if (wallet.fetchError) return false;
  if (isInvalidSolanaAddress(wallet.address)) return false;

  if (wallet.txCount == null) return false;
  if (wallet.balance == null) return false;

  // Behavior filter
  if (wallet.txCount < 5) return false;
  if (wallet.balance < 0.1) return false;

  return true;
}

function mergeSeedWithLive(seed: SmartMoneyWallet, live: NormalizedWalletActivity): SmartMoneyWallet {
  return {
    ...seed,
    balance: live.balance,
    txCount: live.txCount,
    lastActivity: live.lastActivity,
    inflow24h: live.inflow24h,
    outflow24h: live.outflow24h,
    fetchError: live.fetchError,
  };
}

export async function getLiveSmartMoneyWallets(): Promise<SmartMoneyWallet[]> {
  // Fetch sequentially to avoid rate limits from external RPC providers.
  const results: SmartMoneyWallet[] = [];
  for (const seed of smartMoneyWallets) {
    const live = await getLiveWallet(seed.chain, seed.address);
    results.push(mergeSeedWithLive(seed, live));
  }
  // SOL-only filtering: exclude system/program accounts and low-activity wallets.
  return results.filter((w) => {
    if (w.chain !== "solana") return true;
    return solWalletPassesFilters(w);
  });
}

export async function getLiveSmartMoneyWalletsWithLimit(limit: number): Promise<SmartMoneyWallet[]> {
  const ordered = smartMoneyWallets.slice().sort((a, b) => b.score - a.score).slice(0, limit);
  // Fetch sequentially to avoid rate limits from external RPC providers.
  const results: SmartMoneyWallet[] = [];
  for (const seed of ordered) {
    const live = await getLiveWallet(seed.chain, seed.address);
    results.push(mergeSeedWithLive(seed, live));
  }
  // SOL-only filtering: exclude system/program accounts and low-activity wallets.
  return results.filter((w) => {
    if (w.chain !== "solana") return true;
    return solWalletPassesFilters(w);
  });
}

export async function getLiveWallet(
  chain: SmartMoneyWallet["chain"],
  address: string,
): Promise<NormalizedWalletActivity> {
  if (chain === "bitcoin") return getBtcWalletActivity(address);
  if (chain === "ethereum") return getEthWalletActivity(address);
  return getSolWalletActivity(address);
}

