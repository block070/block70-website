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
      console.error("ETHERSCAN_API_KEY missing");
      return {
        address,
        chain: CHAIN,
        balance: null,
        txCount: null,
        lastActivity: null,
        inflow24h: null,
        outflow24h: null,
        fetchError: "ETHERSCAN_API_KEY missing",
      };
    }

    try {
      // Debug logging for data accuracy issues.
      console.log(process.env.ETHERSCAN_API_KEY);
      const base = "https://api.etherscan.io/api";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const balanceRes = await fetch(
        `${base}?module=account&action=balance&address=${encodeURIComponent(address)}&tag=latest&apikey=${encodeURIComponent(apiKey)}`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!balanceRes.ok) throw new Error(`balance HTTP ${balanceRes.status}`);
      const data = await balanceRes.json();
      console.log("ETH RESPONSE:", data);

      if (String(data?.status ?? "0") !== "1") {
        throw new Error(`Etherscan balance error: ${data?.message ?? "unknown"} (${data?.result ?? ""})`);
      }
      const balanceWei = data?.result;
      const balance = weiToEthNumber(String(balanceWei ?? "0"));

      // txlist (recent transactions)
      const txRes = await fetch(
        `${base}?module=account&action=txlist&address=${encodeURIComponent(address)}&page=1&offset=200&startblock=0&endblock=99999999&sort=desc&apikey=${encodeURIComponent(apiKey)}`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!txRes.ok) throw new Error(`txlist HTTP ${txRes.status}`);
      const dataTx = await txRes.json();
      console.log("ETH RESPONSE:", dataTx);
      const txs: any[] = Array.isArray(dataTx?.result) ? dataTx.result : [];

      if (String(dataTx?.status ?? "0") !== "1") {
        // Some wallets may return status=0 with message="No transactions found"
        // Treat as no activity (0 tx) but still not as an upstream failure.
        // If it isn't No transactions, we throw to surface error.
        const msg = String(dataTx?.message ?? "");
        if (msg && !msg.toLowerCase().includes("no transactions")) {
          throw new Error(`Etherscan txlist error: ${msg} (${dataTx?.result ?? ""})`);
        }
      }
      clearTimeout(timeout);

      const nowMs = Date.now();
      const cutoffMs = nowMs - 24 * 60 * 60 * 1000;

      const txCount = txs.length;
      const lastActivity = toIso(txs[0]?.timeStamp ?? null);

      return {
        address,
        chain: CHAIN,
        balance,
        txCount,
        lastActivity,
        // Netflow temporarily disabled due to accuracy concerns.
        inflow24h: null,
        outflow24h: null,
        fetchError: null,
      };
    } catch (err) {
      console.error("ETH wallet fetch failed", { address, err: String(err) });
      return {
        address,
        chain: CHAIN,
        balance: null,
        txCount: null,
        lastActivity: null,
        inflow24h: null,
        outflow24h: null,
        fetchError: String(err ?? "ETH wallet fetch failed"),
      };
    }
  });
}

