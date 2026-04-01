/**
 * Sanity-check /market payload without `next start`.
 * Run: cd apps/web && npm run verify:macro
 */
import { buildMacroDashboardUncached } from "../lib/market/build-macro-dashboard";

async function main() {
  const d = await buildMacroDashboardUncached();
  const mcap = d.global.totalMarketCapUsd;
  const vol = d.global.totalVolumeUsd;
  const nHeat = d.heatmapCoins.length;
  const nScatter = d.scatter.filter((x) => x.marketCap > 0).length;
  const pie = d.dominancePie.length;

  console.log("[verify:macro] mcap:", mcap, "vol:", vol);
  console.log(
    "[verify:macro] btc%:",
    d.global.btcDominancePct,
    "eth%:",
    d.global.ethDominancePct,
  );
  console.log("[verify:macro] heatmap coins:", nHeat, "scatter:", nScatter, "pie slices:", pie);
  console.log("[verify:macro] meta:", d.meta.marketSource, d.meta.marketAsOf?.slice(0, 19));

  const ok =
    mcap != null &&
    mcap > 1e9 &&
    vol != null &&
    vol > 1e8 &&
    nHeat >= 15 &&
    nScatter >= 15 &&
    pie >= 1 &&
    d.global.btcDominancePct != null &&
    d.global.ethDominancePct != null;

  if (!ok) {
    console.error("[verify:macro] FAILED: expected live global stats + tape (CoinGecko should fill gaps).");
    process.exit(1);
  }
  console.log("[verify:macro] PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
