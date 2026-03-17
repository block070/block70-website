export type SeedNewsItem = {
  id: number;
  title: string;
  source: string;
  category: string;
  summary: string;
  published_at: string;
  url: string;
  tags?: string[];
};

// Deterministic, curated news seed used for both the homepage and /news
export const SEEDED_NEWS: SeedNewsItem[] = [
  {
    id: 1,
    title: "Flagship L2 extends ecosystem incentives for builders",
    source: "Block70 Macro Feed",
    category: "Ecosystem incentives",
    summary:
      "A leading Layer 2 announces an extension of its grant and incentive programs, aiming to pull more TVL and developer activity onto the network.",
    published_at: "2026-03-15T10:00:00.000Z",
    url: "/news",
    tags: ["L2", "Incentives", "TVL"],
  },
  {
    id: 2,
    title: "New Solana perp DEX crosses $1B in daily volume",
    source: "DEX Radar",
    category: "Perp DEX",
    summary:
      "A high-performance Solana DEX quickly climbs the volume ranks as perp traders rotate in, driven by tight spreads and deep liquidity.",
    published_at: "2026-03-15T07:00:00.000Z",
    url: "/news",
    tags: ["Solana", "Perps", "DEX"],
  },
  {
    id: 3,
    title: "Restaking primitive launches on mainnet with guarded caps",
    source: "Validator Watch",
    category: "Restaking",
    summary:
      "A new restaking protocol goes live with conservative caps and phased rollout, kicking off an early wave of experimentation from validators and DAOs.",
    published_at: "2026-03-14T18:00:00.000Z",
    url: "/news",
    tags: ["Restaking", "Staking", "Infrastructure"],
  },
];

