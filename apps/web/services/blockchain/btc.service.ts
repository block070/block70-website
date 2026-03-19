import type { NormalizedWalletActivity } from "./types";
import { cached } from "./cache";

const CHAIN = "bitcoin";
const SATOSHI_PER_BTC = 100_000_000;
const SATOSHI_BI = 100_000_000n;

function satsToBtcNumber(sats: bigint): number {
  const whole = sats / SATOSHI_BI;
  const frac = sats % SATOSHI_BI;
  const btc = Number(whole) + Number(frac) / 1e8;
  return Number.isFinite(btc) ? btc : 0;
}

function formatIsoFromBlockTime(blockTime?: number | null): string | null {
  if (!blockTime) return null;
  // blockTime is in seconds
  return new Date(blockTime * 1000).toISOString();
}

async function fetchJson(url: string, attempts = 3) {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as any;
    } catch (err) {
      lastErr = err;
      const isRetryable = String(err).includes("HTTP 429") || String(err).includes("HTTP 5");
      if (attempt >= attempts - 1 || !isRetryable) throw err;
      const waitMs = 500 * (attempt + 1);
      await new Promise((r) => setTimeout(r, waitMs));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastErr;
}

export async function getBtcWalletActivity(address: string): Promise<NormalizedWalletActivity> {
  const cacheKey = `btc:${address}`;
  return cached(cacheKey, 180, async () => {
    try {
      const addrInfo = await fetchJson(`https://blockstream.info/api/address/${address}`);
      const funded = BigInt(String(addrInfo?.chain_stats?.funded_txo_sum ?? "0"));
      const spent = BigInt(String(addrInfo?.chain_stats?.spent_txo_sum ?? "0"));
      const txCount =
        Number(addrInfo?.chain_stats?.tx_count ?? 0) +
        Number(addrInfo?.mempool_stats?.tx_count ?? 0);
      const balanceSats = funded - spent;
      const balance = satsToBtcNumber(balanceSats < 0n ? 0n : balanceSats);

      // Last activity
      const latestTxs = await fetchJson(
        `https://blockstream.info/api/address/${address}/txs?limit=1`,
      );
      const latest = Array.isArray(latestTxs) ? latestTxs[0] : null;
      const lastActivity = formatIsoFromBlockTime(latest?.status?.block_time ?? null);

      // In/out within last 24h (approximate based on address outputs/prevouts)
      const nowMs = Date.now();
      const cutoffMs = nowMs - 24 * 60 * 60 * 1000;
      let inflowSats = 0n;
      let outflowSats = 0n;

      const txs = await fetchJson(
        `https://blockstream.info/api/address/${address}/txs?limit=50`,
      );
      const items: any[] = Array.isArray(txs) ? txs : [];

      for (const tx of items) {
        const bt = tx?.status?.block_time;
        const txMs = bt ? bt * 1000 : null;
        if (!txMs || txMs < cutoffMs) continue;

        const vout = Array.isArray(tx?.vout) ? tx.vout : [];
        for (const out of vout) {
          if (out?.scriptpubkey_address === address) {
            inflowSats += BigInt(String(out?.value ?? "0"));
          }
        }

        const vin = Array.isArray(tx?.vin) ? tx.vin : [];
        for (const input of vin) {
          const prev = input?.prevout;
          if (prev?.scriptpubkey_address === address) {
            outflowSats += BigInt(String(prev?.value ?? "0"));
          }
        }
      }

      const inflow24h = satsToBtcNumber(inflowSats);
      const outflow24h = satsToBtcNumber(outflowSats);

      return {
        address,
        chain: CHAIN,
        balance,
        txCount: Number.isFinite(txCount) ? txCount : null,
        lastActivity,
        inflow24h,
        outflow24h,
      };
    } catch (err) {
      console.error("BTC wallet fetch failed", { address, err: String(err) });
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

