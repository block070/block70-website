import type { NormalizedWalletActivity } from "./types";
import { cached } from "./cache";

const CHAIN = "ethereum";
const WEI_PER_ETH = 10n ** 18n;

function weiToEthNumber(weiStr: string): number {
  try {
    const wei = BigInt(weiStr);
    const whole = wei / WEI_PER_ETH;
    const frac = wei % WEI_PER_ETH;
    // Keep a reasonable precision for UI
    const fracFloat = Number(frac) / 1e18;
    return Number(whole) + fracFloat;
  } catch {
    return 0;
  }
}

function toIso(tsSeconds: string | number | undefined | null): string | null {
  if (tsSeconds == null) return null;
  const n = typeof tsSeconds === "string" ? Number(tsSeconds) : tsSeconds;
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

export async function getEthWalletActivity(address: string): Promise<NormalizedWalletActivity> {
  const cacheKey = `eth:${address.toLowerCase()}`;
  return cached(cacheKey, 180, async () => {
    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (!apiKey) {
      return {
        address,
        chain: CHAIN,
        balance: null,
        txCount: null,
        lastActivity: null,
        inflow24h: null,
        outflow24h: null,
      };
    }

    try {
      const base = "https://api.etherscan.io/api";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const balanceRes = await fetch(
        `${base}?module=account&action=balance&address=${encodeURIComponent(address)}&tag=latest&apikey=${encodeURIComponent(apiKey)}`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!balanceRes.ok) throw new Error(`balance HTTP ${balanceRes.status}`);
      const balanceJson = await balanceRes.json();
      const balanceWei = balanceJson?.result;
      const balance = weiToEthNumber(String(balanceWei ?? "0"));

      // txlist (recent transactions)
      const txRes = await fetch(
        `${base}?module=account&action=txlist&address=${encodeURIComponent(address)}&page=1&offset=200&startblock=0&endblock=99999999&sort=desc&apikey=${encodeURIComponent(apiKey)}`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!txRes.ok) throw new Error(`txlist HTTP ${txRes.status}`);
      const txJson = await txRes.json();
      const txs: any[] = Array.isArray(txJson?.result) ? txJson.result : [];
      clearTimeout(timeout);

      const nowMs = Date.now();
      const cutoffMs = nowMs - 24 * 60 * 60 * 1000;

      let lastActivity: string | null = null;
      let txCount = 0;
      let inflowWei = 0n;
      let outflowWei = 0n;

      for (const tx of txs) {
        const timeStamp = tx?.timeStamp;
        const iso = toIso(timeStamp);
        const txMs = iso ? new Date(iso).getTime() : null;
        if (!txMs) continue;
        if (!lastActivity && txMs) {
          lastActivity = iso;
        }
        if (txMs < cutoffMs) continue;
        txCount += 1;
        const valueWei = BigInt(tx?.value ?? "0");
        const from = String(tx?.from ?? "").toLowerCase();
        const to = String(tx?.to ?? "").toLowerCase();
        const addrLower = address.toLowerCase();
        if (to === addrLower) inflowWei += valueWei;
        if (from === addrLower) outflowWei += valueWei;
      }

      const inflow24h = txCount > 0 ? weiToEthNumber(inflowWei.toString()) : null;
      const outflow24h = txCount > 0 ? weiToEthNumber(outflowWei.toString()) : null;

      return {
        address,
        chain: CHAIN,
        balance,
        txCount: txCount || null,
        lastActivity,
        inflow24h,
        outflow24h,
      };
    } catch {
      // Swallow upstream errors so UI can show "data unavailable".
      return {
        address,
        chain: CHAIN,
        balance: null,
        txCount: null,
        lastActivity: null,
        inflow24h: null,
        outflow24h: null,
      };
    }
  });
}

