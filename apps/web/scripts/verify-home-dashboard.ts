/**
 * Sanity-checks homepage market data without starting Next.
 * Run from apps/web: `npx tsx scripts/verify-home-dashboard.ts`
 */
import { getBackendApiBase, hostOf } from "../lib/backend-api-base";
import { buildHomeDashboard } from "../lib/home/build-home-dashboard";
import { fetchCoingeckoHomeMarketBundle } from "../lib/market/coingecko-home-fallback";

const DEMO_SOL_PRICE = 142.5;

function assertApiBaseInferenceContract(): void {
  if (hostOf("https://www.block70.com") !== "www.block70.com") {
    throw new Error("[verify] hostOf(block70) regression");
  }
  const snap: Record<string, string | undefined> = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    API_SERVER_URL: process.env.API_SERVER_URL,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  };
  try {
    delete process.env.API_SERVER_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.VERCEL_URL;
    Object.assign(process.env, {
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://block70.com",
    });
    const b = getBackendApiBase();
    if (b !== "https://api.block70.com") {
      throw new Error(
        `[verify] Expected inferred API https://api.block70.com (server fetchJson must use this), got "${b}"`,
      );
    }
    console.log("[verify] Inferred production API base OK:", b);
  } finally {
    for (const k of Object.keys(snap)) {
      const v = snap[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

async function main() {
  assertApiBaseInferenceContract();

  const cg = await fetchCoingeckoHomeMarketBundle(25);
  if (!cg.coins.length) {
    throw new Error(
      "CoinGecko /coins/markets returned 0 rows — check network, User-Agent, API key, or rate limits.",
    );
  }
  if (cg.global?.total_market_cap_usd == null && cg.global?.total_volume_usd == null) {
    console.warn(
      "[verify] CoinGecko /global has no mcap/volume — hero may still derive from /coins/markets.",
    );
  }
  console.log(
    "[verify] CoinGecko OK:",
    "global",
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
