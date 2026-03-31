/**
 * Sanity-checks homepage market data without starting Next.
 * Run from apps/web: `npx tsx scripts/verify-home-dashboard.ts`
 */
import { buildHomeDashboard } from "../lib/home/build-home-dashboard";
import { fetchCoingeckoHomeMarketBundle } from "../lib/market/coingecko-home-fallback";

const DEMO_SOL_PRICE = 142.5;

async function main() {
  const cg = await fetchCoingeckoHomeMarketBundle(25);
  if (!cg.coins.length) {
    throw new Error(
      "CoinGecko /coins/markets returned 0 rows — check network, User-Agent, API key, or rate limits.",
    );
  }
  if (cg.global?.total_market_cap_usd == null && cg.global?.total_volume_usd == null) {
    throw new Error("CoinGecko /global returned no mcap/volume — homepage hero cannot populate from fallback.");
  }
  console.log(
    "[verify] CoinGecko OK:",
    "mcap",
    cg.global?.total_market_cap_usd != null ? "yes" : "no",
    "coins",
    cg.coins.length,
  );

  const dash = await buildHomeDashboard();
  const { hero, market } = dash;

  const heroOk =
    hero.totalMarketCapUsd != null ||
    hero.volume24hUsd != null ||
    hero.btcDominancePct != null ||
    hero.ethDominancePct != null;
  if (!heroOk) {
    throw new Error(
      "buildHomeDashboard hero has no mcap/vol/dominance — summary + CoinGecko both failed or were stripped.",
    );
  }

  if (!market.heatmap.length) {
    throw new Error("Heatmap is empty — vk pipeline failed entirely.");
  }

  const first = market.heatmap[0]!;
  const looksDemo =
    first.symbol === "SOL" &&
    typeof first.price === "number" &&
    Math.abs(first.price - DEMO_SOL_PRICE) < 0.05;

  if (looksDemo) {
    throw new Error(
      "Heatmap still matches bundled DEMO (SOL ~142.524) — live vk + CoinGecko did not replace demo tiles.",
    );
  }

  console.log("[verify] Dashboard OK: hero mcap", hero.totalMarketCapUsd, "heatmap[0]", first.symbol, first.price);
  console.log("[verify] PASSED");
}

main().catch((e) => {
  console.error("[verify] FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
