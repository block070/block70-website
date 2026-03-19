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
  const tasks = smartMoneyWallets.map(async (seed) => {
    const live = await getLiveWallet(seed.chain, seed.address);
    return mergeSeedWithLive(seed, live);
  });
  return Promise.all(tasks);
}

export async function getLiveSmartMoneyWalletsWithLimit(limit: number): Promise<SmartMoneyWallet[]> {
  const ordered = smartMoneyWallets.slice().sort((a, b) => b.score - a.score).slice(0, limit);
  const tasks = ordered.map(async (seed) => {
    const live = await getLiveWallet(seed.chain, seed.address);
    return mergeSeedWithLive(seed, live);
  });
  return Promise.all(tasks);
}

export async function getLiveWallet(
  chain: SmartMoneyWallet["chain"],
  address: string,
): Promise<NormalizedWalletActivity> {
  if (chain === "bitcoin") return getBtcWalletActivity(address);
  if (chain === "ethereum") return getEthWalletActivity(address);
  return getSolWalletActivity(address);
}

