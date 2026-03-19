import { getBtcWalletActivity } from "@/services/blockchain/btc.service";
import { getEthWalletActivity } from "@/services/blockchain/eth.service";
import { getSolWalletActivity } from "@/services/blockchain/sol.service";
import { smartMoneyWallets, type SmartMoneyWallet } from "@/data/smartMoneyWallets";
import type { NormalizedWalletActivity } from "@/services/blockchain/types";

function mergeSeedWithLive(seed: SmartMoneyWallet, live: NormalizedWalletActivity): SmartMoneyWallet {
  return {
    ...seed,
    balance: live.balance,
    txCount: live.txCount,
    lastActivity: live.lastActivity,
    inflow24h: live.inflow24h,
    outflow24h: live.outflow24h,
  };
}

export async function getLiveSmartMoneyWallets(): Promise<SmartMoneyWallet[]> {
  // Fetch sequentially to avoid rate limits from external RPC providers.
  const results: SmartMoneyWallet[] = [];
  for (const seed of smartMoneyWallets) {
    const live = await getLiveWallet(seed.chain, seed.address);
    results.push(mergeSeedWithLive(seed, live));
  }
  return results;
}

export async function getLiveSmartMoneyWalletsWithLimit(limit: number): Promise<SmartMoneyWallet[]> {
  const ordered = smartMoneyWallets.slice().sort((a, b) => b.score - a.score).slice(0, limit);
  // Fetch sequentially to avoid rate limits from external RPC providers.
  const results: SmartMoneyWallet[] = [];
  for (const seed of ordered) {
    const live = await getLiveWallet(seed.chain, seed.address);
    results.push(mergeSeedWithLive(seed, live));
  }
  return results;
}

export async function getLiveWallet(
  chain: SmartMoneyWallet["chain"],
  address: string,
): Promise<NormalizedWalletActivity> {
  if (chain === "bitcoin") return getBtcWalletActivity(address);
  if (chain === "ethereum") return getEthWalletActivity(address);
  return getSolWalletActivity(address);
}

