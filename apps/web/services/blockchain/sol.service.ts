import type { NormalizedWalletActivity } from "./types";
import { cached } from "./cache";
import { Connection, PublicKey } from "@solana/web3.js";

const CHAIN = "solana";

const LAMPORTS_PER_SOL = 1_000_000_000;

function lamportsToSol(n: number): number {
  return n / LAMPORTS_PER_SOL;
}

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err);
      const isRetryable = msg.includes("429") || msg.toLowerCase().includes("too many requests");
      if (attempt >= attempts - 1 || !isRetryable) throw err;
      const waitMs = 500 * (attempt + 1);
      console.warn("SOL RPC retry", { attempt: attempt + 1, waitMs, err: msg.slice(0, 200) });
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

export async function getSolWalletActivity(address: string): Promise<NormalizedWalletActivity> {
  const cacheKey = `sol:${address}`;
  return cached(cacheKey, 180, async () => {
    try {
      const connection = new Connection(
        process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
        "confirmed",
      );

      const pubkey = new PublicKey(address);

      const nowMs = Date.now();
      const cutoffMs = nowMs - 24 * 60 * 60 * 1000;

      const lamports = await retry(() => connection.getBalance(pubkey));
      const balance = lamportsToSol(lamports);

      const sigs = await retry(() => connection.getSignaturesForAddress(pubkey, { limit: 120 }));

      const lastActivity = sigs[0]?.blockTime
        ? new Date(sigs[0].blockTime * 1000).toISOString()
        : null;

      const inWindow = sigs.filter((s) => {
        if (!s.blockTime) return false;
        return s.blockTime * 1000 >= cutoffMs;
      });

      const txCount = inWindow.length;

      let inflowLamports = 0;
      let outflowLamports = 0;

      const toProcess = inWindow.slice(0, 30); // cap to avoid RPC spam
      for (const s of toProcess) {
        const tx = await retry(() => connection.getTransaction(s.signature, { commitment: "confirmed" }));
        const meta = tx?.meta;
        if (!meta?.preBalances || !meta?.postBalances) continue;
        const accountKeys = tx?.transaction?.message?.accountKeys ?? [];
        const idx = accountKeys.findIndex((k) => k.toString() === address);
        if (idx < 0) continue;
        const pre = meta.preBalances[idx];
        const post = meta.postBalances[idx];
        const diff = post - pre;
        if (diff > 0) inflowLamports += diff;
        if (diff < 0) outflowLamports += Math.abs(diff);
      }

      const inflow24h = lamportsToSol(inflowLamports);
      const outflow24h = lamportsToSol(outflowLamports);

      return {
        address,
        chain: CHAIN,
        balance,
        txCount,
        lastActivity,
        inflow24h,
        outflow24h,
      };
    } catch (err) {
      console.error("SOL wallet fetch failed", { address, err: String(err) });
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

