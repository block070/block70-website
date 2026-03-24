import { computeBlock70Score, syntheticSparkline7d } from "@/lib/coins-scanner";
import type { Coin } from "@/lib/crypto-mock";

export type TrendingTier = "exploding" | "trending" | "warming" | "low";

export type QuickSignalKey = "strong-buy" | "watch" | "risky";

export type SmartMoney = "accumulating" | "selling" | "neutral";

export type Momentum = "up" | "flat" | "down";

export type TrendTab = "all" | "depin" | "ai" | "l1" | "meme" | "gaming";

export const TRENDING_TABS: { id: TrendTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "depin", label: "DePIN" },
  { id: "ai", label: "AI" },
  { id: "l1", label: "Layer 1" },
  { id: "meme", label: "Meme" },
  { id: "gaming", label: "Gaming" },
];

export function tierFromTrendingScore(score: number): {
  tier: TrendingTier;
  label: string;
  emoji: string;
} {
  if (score >= 80) return { tier: "exploding", label: "Exploding", emoji: "🔥" };
  if (score >= 60) return { tier: "trending", label: "Trending", emoji: "🚀" };
  if (score >= 40) return { tier: "warming", label: "Warming Up", emoji: "⚡" };
  return { tier: "low", label: "Low Interest", emoji: "" };
}

export function tierScoreClasses(tier: TrendingTier): string {
  switch (tier) {
    case "exploding":
      return "text-orange-300 bg-orange-500/15 border-orange-500/40";
    case "trending":
      return "text-emerald-300 bg-emerald-500/15 border-emerald-500/40";
    case "warming":
      return "text-amber-200 bg-amber-500/15 border-amber-500/35";
    default:
      return "text-slate-400 bg-slate-800/80 border-slate-600/50";
  }
}

export function quickSignalFromBlock70(score: number): {
  key: QuickSignalKey;
  label: string;
  className: string;
} {
  if (score >= 80) {
    return {
      key: "strong-buy",
      label: "Strong Buy",
      className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    };
  }
  if (score >= 60) {
    return {
      key: "watch",
      label: "Watch",
      className: "bg-amber-500/15 text-amber-200 border-amber-500/35",
    };
  }
  return {
    key: "risky",
    label: "Risky",
    className: "bg-red-500/15 text-red-300 border-red-500/40",
  };
}

export function momentumFromPrice(p24: number, p7: number): Momentum {
  const p24f = Number.isFinite(p24) ? p24 : 0;
  const p7f = Number.isFinite(p7) ? p7 : 0;
  const expectedDaily = p7f / 7;
  const accel = p24f - expectedDaily;
  if (accel > 0.35) return "up";
  if (accel < -0.35) return "down";
  return "flat";
}

export function smartMoneyLabel(
  p24: number,
  p7: number,
  volume24hUsd: number,
  marketCapUsd: number
): SmartMoney {
  const p24f = Number.isFinite(p24) ? p24 : 0;
  const p7f = Number.isFinite(p7) ? p7 : 0;
  const turnover = volume24hUsd / Math.max(marketCapUsd, 1);
  const pressure = p24f * 0.65 + (p7f / 7) * 0.35;
  if (pressure > 1 && turnover > 0.015) return "accumulating";
  if (pressure < -1.1) return "selling";
  return "neutral";
}

export function smartMoneyDisplay(sm: SmartMoney): { label: string; className: string } {
  switch (sm) {
    case "accumulating":
      return { label: "Accumulating", className: "text-emerald-400" };
    case "selling":
      return { label: "Selling", className: "text-red-400" };
    default:
      return { label: "Neutral", className: "text-slate-400" };
  }
}

export function momentumGlyph(m: Momentum): string {
  if (m === "up") return "↑";
  if (m === "down") return "↓";
  return "→";
}

export function momentumTitle(m: Momentum): string {
  if (m === "up") return "Accelerating";
  if (m === "down") return "Slowing";
  return "Stable";
}

/** Map DB/API category + slug/name to a filter tab; null = only visible on “All”. */
export function inferTrendTab(
  category: string | null | undefined,
  slug: string,
  name: string
): TrendTab | null {
  const c = (category ?? "").toLowerCase();
  const s = slug.toLowerCase();
  const n = name.toLowerCase();
  const hay = `${c} ${s} ${n}`;

  if (
    /depin|de-pin|physical|infrastructure|internet-of-things|iot\b|helium|filecoin|arweave|streamr|theta|render-network|akash|storj/.test(
      hay
    )
  ) {
    return "depin";
  }

  if (
    /artificial|ai-big|big-data|machine|fetch|bittensor|singularity|ocean-protocol|numerai|gpt|llm|agi\b/.test(
      hay
    ) ||
    /\b(ai|agi)\b/.test(hay)
  ) {
    return "ai";
  }

  if (
    /layer-1|layer 1|smart-contract|proof-of-work|proof-of-stake|ethereum|bitcoin|solana|avalanche|polkadot|cosmos|sui|aptos|near-protocol|fantom|tron|cardano|algorand|hedera|monero|litecoin|celestia|injective|sei-network/.test(
      hay
    ) ||
    /\b(l1|layer-1)\b/.test(hay)
  ) {
    return "l1";
  }

  if (/meme|doge|shiba|pepe|floki|bonk|trump|wojak|memecoin/.test(hay)) {
    return "meme";
  }

  if (/gaming|gamefi|metaverse|play-to-earn|axie|sandbox|gala|immutable|ronin|illuvium/.test(hay)) {
    return "gaming";
  }

  return null;
}

export type TrendingMetricInput = {
  volume24hUsd: number;
  marketCapUsd: number;
  change24hPct: number;
  change7dPct: number;
  coingeckoRank: number;
  coingeckoScore: number | null;
  listLength: number;
};

/**
 * Trending score 0–100: volume activity vs peers, momentum, CoinGecko buzz rank,
 * and a light whale/social proxy (no extra HTTP calls).
 */
export function computeTrendingScore(row: TrendingMetricInput): number {
  const { volume24hUsd, marketCapUsd, change24hPct, change7dPct, coingeckoRank, coingeckoScore, listLength } =
    row;
  const mcap = Math.max(marketCapUsd, 1);
  const turnover = volume24hUsd / mcap;

  const p24 = Number.isFinite(change24hPct) ? Math.max(-25, Math.min(25, change24hPct)) : 0;
  const p7 = Number.isFinite(change7dPct) ? Math.max(-40, Math.min(40, change7dPct)) : 0;

  const mom = 50 + p24 * 1.35 + (p7 / 7) * 2.8;
  const momentumScore = Math.max(0, Math.min(100, mom));

  const n = Math.max(listLength, 1);
  const buzz = 100 * (1 - (coingeckoRank - 1) / Math.max(n - 1, 1));
  const buzzScore = Number.isFinite(buzz) ? Math.max(0, Math.min(100, buzz)) : 50;

  const rawCg = coingeckoScore;
  const cgNorm =
    typeof rawCg === "number" && Number.isFinite(rawCg)
      ? Math.min(100, Math.max(0, rawCg * 22))
      : buzzScore * 0.85;

  const volRatio = Math.log10(1 + turnover * 200);
  const volumeScore = Math.min(100, Math.max(0, volRatio * 28));

  const sm = smartMoneyLabel(change24hPct, change7dPct, volume24hUsd, marketCapUsd);
  const whaleScore =
    sm === "accumulating" ? 78 : sm === "selling" ? 32 : 52;

  const blended =
    volumeScore * 0.28 +
    momentumScore * 0.32 +
    buzzScore * 0.18 +
    cgNorm * 0.12 +
    whaleScore * 0.1;

  return Math.round(Math.max(0, Math.min(100, blended)));
}

export function pickWhyTrendingTag(args: {
  volumeScore: number;
  p24: number;
  p7: number;
  coingeckoRank: number;
  smartMoney: SmartMoney;
}): string {
  const { volumeScore, p24, p7, coingeckoRank, smartMoney } = args;
  const p24f = Number.isFinite(p24) ? p24 : 0;
  const p7f = Number.isFinite(p7) ? p7 : 0;

  if (smartMoney === "accumulating" && volumeScore >= 48) return "Whale Accumulation";
  if (volumeScore >= 68) return "Volume Spike";
  if (p24f > 4.5 || p7f > 12) return "Price Breakout";
  if (coingeckoRank <= 5) return "News Catalyst";
  if (smartMoney === "accumulating") return "Whale Accumulation";
  return "Volume Spike";
}

export type EnrichedTrendingRow = {
  coin: Coin;
  block70Score: number;
  trendingScore: number;
  tier: ReturnType<typeof tierFromTrendingScore>;
  whyTag: string;
  quickSignal: ReturnType<typeof quickSignalFromBlock70>;
  momentum: Momentum;
  smartMoney: SmartMoney;
  sparkline7d: number[];
  trendTab: TrendTab | null;
  volumeScorePart: number;
};

export function enrichTrendingRows(
  coins: Coin[],
  meta: {
    coingeckoScores: (number | null)[];
    categoryLabels?: (string | null)[];
  }
): EnrichedTrendingRow[] {
  const listLength = coins.length;
  const inputs: TrendingMetricInput[] = coins.map((c, i) => ({
    volume24hUsd: c.volume24hUsd ?? 0,
    marketCapUsd: c.marketCapUsd ?? 0,
    change24hPct: c.change24hPct,
    change7dPct: c.change7dPct,
    coingeckoRank: i + 1,
    coingeckoScore: meta.coingeckoScores[i] ?? null,
    listLength,
  }));

  const turnovers = inputs.map((x) => x.volume24hUsd / Math.max(x.marketCapUsd, 1));
  const sorted = [...turnovers].sort((a, b) => a - b);
  const medianT = sorted[Math.floor(sorted.length / 2)] ?? 1e-12;

  return coins.map((coin, i) => {
    const inp = inputs[i];
    const t = inp.volume24hUsd / Math.max(inp.marketCapUsd, 1);
    const ratio = medianT > 0 ? t / medianT : 1;
    const volumeScorePart = Math.min(100, 38 * Math.log10(1 + Math.max(0, ratio)));

    const trendingScore = computeTrendingScore(inp);
    const tier = tierFromTrendingScore(trendingScore);

    const block70Score = computeBlock70Score(coin);

    const sm = smartMoneyLabel(
      coin.change24hPct,
      coin.change7dPct,
      coin.volume24hUsd,
      coin.marketCapUsd
    );

    const whyTag = pickWhyTrendingTag({
      volumeScore: volumeScorePart,
      p24: coin.change24hPct,
      p7: coin.change7dPct,
      coingeckoRank: i + 1,
      smartMoney: sm,
    });

    return {
      coin,
      block70Score,
      trendingScore,
      tier,
      whyTag,
      quickSignal: quickSignalFromBlock70(block70Score),
      momentum: momentumFromPrice(coin.change24hPct, coin.change7dPct),
      smartMoney: sm,
      sparkline7d: syntheticSparkline7d(coin.priceUsd, coin.change7dPct),
      trendTab: inferTrendTab(
        meta.categoryLabels?.[i] ?? coin.categoryIds?.[0] ?? null,
        coin.slug,
        coin.name
      ),
      volumeScorePart,
    };
  });
}
