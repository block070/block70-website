/**
 * Block70 Developer API - JavaScript/Node example.
 * Use your API key from https://block70.com/developers
 */

const API_BASE = process.env.BLOCK70_API_BASE || "https://api.block70.com";
const API_KEY = process.env.BLOCK70_API_KEY || "bk70_your_key_here";

async function get(path, params = {}) {
  const url = new URL(`${API_BASE}/api/v1/dev${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    headers: { "X-API-Key": API_KEY },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

(async () => {
  // Signals
  const signals = await get("/signals", { limit: 10 });
  console.log("Latest signals:", signals.length, "items");

  const latest = await get("/signals/latest", { limit: 5 });
  const solSignals = await get("/signals/SOL");

  // Opportunities
  const opportunities = await get("/opportunities", { limit: 20 });
  console.log("Opportunities:", opportunities.length, "items");

  // Market
  const prices = await get("/market/prices", { limit: 10 });
  const trending = await get("/market/trending", { limit: 10 });
  const gainers = await get("/market/gainers");
  const losers = await get("/market/losers");

  // Airdrops
  const airdrops = await get("/airdrops");
  const upcoming = await get("/airdrops/upcoming");

  // Wallets
  const wallets = await get("/wallets", { limit: 20 });
  // const wallet = await get("/wallets/0x...");
  // const txs = await get("/wallets/0x.../transactions");

  console.log("Done.");
})();
