import type { NormalizedWalletActivity } from "./types";
import { cached } from "./cache";

const CHAIN = "solana";
const LAMPORTS_PER_SOL = 1_000_000_000;

async function rpcPost(method: string, params: any[]) {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal: controller.signal,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json();
  if (json?.error) throw new Error(`RPC error: ${json.error?.message ?? "unknown"}`);
  return json?.result;
}

function lamportsToSol(n: number): number {
  return n / LAMPORTS_PER_SOL;
}

export async function getSolWalletActivity(address: string): Promise<NormalizedWalletActivity> {
  const cacheKey = `sol:${address}`;
  return cached(cacheKey, 180, async () => {
    try {
      const nowMs = Date.now();
      const cutoffMs = nowMs - 24 * 60 * 60 * 1000;

      const balanceResult = await rpcPost("getBalance", [address, { commitment: "confirmed" }]);
      const balance = typeof balanceResult === "number" ? lamportsToSol(balanceResult) : null;

      const sigResult = await rpcPost("getSignaturesForAddress", [
        address,
        { limit: 120, commitment: "confirmed" },
      ]);
      const sigs: any[] = Array.isArray(sigResult) ? sigResult : [];

      const inWindow = sigs.filter((s) => {
        if (!s?.blockTime) return false;
        return s.blockTime * 1000 >= cutoffMs;
      });

      const lastActivity = inWindow.length
        ? new Date(inWindow[0].blockTime * 1000).toISOString()
        : null;

      const txCount = inWindow.length || null;

      // Best-effort inflow/outflow using balance delta across recent transactions.
      // This is an approximation, but uses real balance changes from RPC transaction metadata.
      let inflowLamports = 0;
      let outflowLamports = 0;

      const toProcess = inWindow.slice(0, 20); // cap to avoid RPC spam
      for (const s of toProcess) {
        const signature = s.signature;
        const tx = await rpcPost("getTransaction", [
          signature,
          { commitment: "confirmed", maxSupportedTransactionVersion: 0 },
        ]);
        const meta = tx?.meta;
        if (!meta?.preBalances || !meta?.postBalances) continue;
        const keys: string[] = (tx?.transaction?.message?.accountKeys ?? []).map((k: any) =>
          typeof k === "string" ? k : k?.pubkey,
        );
        const idx = keys.findIndex((k) => k === address);
        if (idx < 0) continue;
        const pre = meta.preBalances[idx];
        const post = meta.postBalances[idx];
        const diff = post - pre;
        if (diff > 0) inflowLamports += diff;
        if (diff < 0) outflowLamports += Math.abs(diff);
      }

      const inflow24h = inflowLamports > 0 ? lamportsToSol(inflowLamports) : null;
      const outflow24h = outflowLamports > 0 ? lamportsToSol(outflowLamports) : null;

      return {
        address,
        chain: CHAIN,
        balance,
        txCount,
        lastActivity,
        inflow24h,
        outflow24h,
      };
    } catch {
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

