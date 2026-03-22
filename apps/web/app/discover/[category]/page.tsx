import Link from "next/link";
import { getCoinsList } from "@/lib/coins";
import { withTimeout } from "@/lib/with-timeout";
import { CoinTable } from "@/components/market/coin-table";
import { CategoryMarketOverview } from "@/components/discover/category-market-overview";
import { getCategoryDescription } from "@/lib/category-descriptions";
import type { Coin } from "@/lib/crypto-mock";

/** Slug -> human title for display. Covers CoinGecko category ids. */
const SLUG_TO_TITLE: Record<string, string> = {
  "ai-tokens": "AI Tokens",
  "artificial-intelligence": "Artificial Intelligence",
  "artificial-intelligence-ai": "Artificial Intelligence (AI)",
  "artificial-intelligence-(ai)": "Artificial Intelligence (AI)",
  "depin-tokens": "DePIN Tokens",
  depin: "DePIN",
  "gaming-tokens": "Gaming Tokens",
  gaming: "Gaming",
  "layer2-tokens": "Layer 2 Tokens",
  "layer-2": "Layer 2",
  "layer-1": "Layer 1",
  defi: "DeFi",
  "decentralized-finance-defi": "Decentralized Finance (DeFi)",
  "decentralized-exchange-dex": "Decentralized Exchange (DEX)",
  "decentralized-exchange-(dex)": "Decentralized Exchange (DEX)",
  "meme-coins": "Meme Coins",
  meme: "Meme",
  "smart-contract-platform": "Smart Contract Platform",
  "proof-of-work": "Proof of Work",
  "proof-of-work-pow": "Proof of Work (PoW)",
  "proof-of-stake": "Proof of Stake",
  "proof-of-stake-pos": "Proof of Stake (PoS)",
  stablecoins: "Stablecoins",
  infrastructure: "Infrastructure",
  "solana-ecosystem": "Solana Ecosystem",
  "ethereum-ecosystem": "Ethereum Ecosystem",
  "real-world-assets-rwa": "Real World Assets (RWA)",
  "liquid-staking-derivatives": "Liquid Staking Derivatives",
  "yield-bearing-stablecoins": "Yield-Bearing Stablecoins",
  "nft-tokens": "NFT Tokens",
  "tokenized-gold": "Tokenized Gold",
  bridges: "Bridges",
  "world-liberty-financial-portfolio": "World Liberty Financial Portfolio",
  "made-in-usa": "Made in USA",
  "usd-stablecoin": "USD Stablecoin",
  "fiat-backed-stablecoin": "Fiat-Backed Stablecoin",
  "exchange-based-tokens": "Exchange-Based Tokens",
  "made-in-china": "Made in China",
  "alleged-sec-securities": "Alleged SEC Securities",
  "base-native": "Base Native",
  "centralized-exchange-token-cex": "Centralized Exchange (CEX) Token",
  "mica-compliant-stablecoin": "MiCA-Compliant Stablecoin",
  "coinlist-launchpad": "CoinList Launchpad",
  "meme-token": "Meme",
  governance: "Governance",
  "dog-themed-coins": "Dog-Themed",
  "decentralized-exchange": "Decentralized Exchange (DEX)",
  "binance-alpha-spotlight": "Binance Alpha Spotlight",
  "4chan-themed": "4chan-Themed",
  "tokenized-private-credit": "Tokenized Private Credit",
  "elon-musk-inspired-coins": "Elon Musk-Inspired",
  "decentralized-perpetuals": "Perpetuals",
  "tokenized-products": "Tokenized Assets",
  "decentralized-derivatives": "Derivatives",
  "yzi-labs-portfolio": "YZi Labs Portfolio",
  "privacy-coins": "Privacy Coins",
  "bitcoin-fork": "Bitcoin Fork",
  "chain-abstraction": "Chain Abstraction",
  "privacy-blockchain": "Privacy Blockchain",
  "rwa-protocol": "RWA Protocol",
  "privacy-infrastructure": "Privacy Infrastructure",
  "synthetic-dollar": "Synthetic Dollar",
  "trump-affiliated-tokens": "Trump-Affiliated",
  "cross-chain-communication": "Cross-Chain Communication",
  "stablecoin-issuer": "Stablecoin Issuer",
  "crypto-backed-stablecoin": "Crypto-Backed Stablecoin",
  "superchain-ecosystem": "Optimism Superchain Ecosystem",
  oracle: "Oracle",
  "x402-ecosystem": "x402 Ecosystem",
  "yield-farming": "Yield Farming",
  "non-fungible-tokens-nft": "NFT",
  "tokenized-commodities": "Tokenized Commodities",
  "layer-0-l0": "Layer 0 (L0)",
  "automated-market-maker-amm": "Automated Market Maker (AMM)",
  "directed-acyclic-graph-dag": "Directed Acyclic Graph (DAG)",
  "tokenized-t-bills": "Tokenized Treasury Bills (T-Bills)",
  "defi-pulse-index-dpi": "Index Coop DeFi Index",
  gambling: "Gambling (GambleFi)",
  "quantum-resistant": "Quantum-Resistant",
  "prediction-markets": "Prediction Markets",
  "crypto-card-issuer": "Crypto Card Issuer",
  "decentralized-options": "Options",
  "solana-meme-coins": "Solana Meme",
  "lending-borrowing": "Lending/Borrowing Protocols",
  neobank: "Neobank",
  wallets: "Wallets",
  "ai-agents": "AI Agents",
  "payment-solutions": "Payment Solutions",
  metaverse: "Metaverse",
  "binance-hodler-airdrops": "Binance HODLer Airdrops",
  "data-availability": "Data Availability",
  "play-to-earn": "Play To Earn",
  "binance-wallet-ido": "Binance Wallet IDO",
  "frog-themed-coins": "Frog-Themed",
  "mobile-mining": "Mobile Mining",
  socialfi: "SocialFi",
  "the-boy-s-club": "The Boy's Club",
  "yield-bearing-tokens": "Yield-Bearing Tokens",
  storage: "Storage",
  identity: "Decentralized Identifier (DID)",
  rollup: "Rollup",
  "pump-fun": "Pump.fun Ecosystem",
  "liquid-staking": "Liquid Staking",
  "ai-framework": "AI Framework",
  "us-treasury-backed-stablecoin": "US Treasury-Backed Stablecoin",
  "internet-of-things-iot": "Internet of Things (IoT)",
  "ai-agent-launchpad": "AI Agent Launchpad",
  analytics: "Analytics",
  "ai-applications": "AI Applications",
  "bittensor-subnets": "Bittensor Subnets",
  masternodes: "Masternodes",
  sidechain: "SideChain",
  "gaming-blockchains": "Gaming Blockchains",
};

/** Convert URL slug to category query for API. */
function slugToCategoryQuery(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getCategoryTitle(slug: string): string {
  return SLUG_TO_TITLE[slug] ?? slugToCategoryQuery(slug);
}

function itemsToCoins(
  items: Awaited<ReturnType<typeof getCoinsList>>,
  rankStart: number
): Coin[] {
  return items.map((item, i) => ({
    id: String(item.coin.id),
    slug: item.coin.slug,
    symbol: item.coin.symbol,
    name: item.coin.name,
    logoUrl: item.coin.logo_url ?? undefined,
    priceUsd: item.coin.price ?? item.latest_market_data?.price ?? 0,
    marketCapUsd: item.coin.market_cap ?? item.latest_market_data?.market_cap ?? 0,
    volume24hUsd: item.coin.volume_24h ?? item.latest_market_data?.volume_24h ?? 0,
    change24hPct: item.latest_market_data?.price_change_24h ?? Number.NaN,
    change7dPct: item.latest_market_data?.price_change_7d ?? Number.NaN,
    rank: rankStart + i + 1,
    categoryIds: item.coin.category ? [item.coin.category] : [],
    chainIds: item.coin.chain ? [item.coin.chain] : [],
  }));
}

type PageProps = {
  params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { category } = await params;
  const title = getCategoryTitle(category);
  return {
    title: `${title} · Block70 Discover`,
    description: `Explore ${title} tokens. Market cap, 24h volume, top gainers and losers.`,
    openGraph: {
      title: `${title} · Block70`,
      description: `Explore ${title} tokens.`,
    },
  };
}

export default async function DiscoverCategoryPage({ params }: PageProps) {
  const { category } = await params;
  const title = getCategoryTitle(category);

  let items: Awaited<ReturnType<typeof getCoinsList>> = [];

  try {
    items = await withTimeout(
      getCoinsList({ category_slug: category, limit: 100, page: 1 }),
      6_000
    );
  } catch {
    // Use empty state
  }

  const coins = itemsToCoins(items, 0);
  const marketCap = coins.reduce((s, c) => s + (c.marketCapUsd || 0), 0) || undefined;
  const volume24h = coins.reduce((s, c) => s + (c.volume24hUsd || 0), 0) || undefined;

  const withChange = coins.filter((c) => typeof c.change24hPct === "number" && Number.isFinite(c.change24hPct));
  const sortedByGain = [...withChange].sort((a, b) => (b.change24hPct ?? -Infinity) - (a.change24hPct ?? -Infinity));
  const sortedByLoss = [...withChange].sort((a, b) => (a.change24hPct ?? Infinity) - (b.change24hPct ?? Infinity));
  const topGainer = sortedByGain[0];
  const topLoser = sortedByLoss[0];

  const description = getCategoryDescription(category, title);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
          Coins in the {title} category. Explore market data, signals, and opportunities.
        </p>
      </section>

      <CategoryMarketOverview
        categoryName={title}
        marketCap={marketCap}
        volume24h={volume24h}
        topGainer={
          topGainer
            ? {
                symbol: topGainer.symbol,
                slug: topGainer.slug,
                change24h: topGainer.change24hPct ?? 0,
              }
            : undefined
        }
        topLoser={
          topLoser
            ? {
                symbol: topLoser.symbol,
                slug: topLoser.slug,
                change24h: topLoser.change24hPct ?? 0,
              }
            : undefined
        }
      />

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--b70-text)]">About {title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--b70-text-muted)]">
          {description}
        </p>
      </section>

      {items.length === 0 ? (
        <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-8 text-center text-sm text-[var(--b70-text-muted)] shadow-sm">
          No tokens in this category yet. Data is sourced from live market APIs and the coin database.
        </section>
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--b70-text)]">Coins</h2>
          <CoinTable coins={coins} />
        </section>
      )}

      <p className="text-xs text-[var(--b70-text-muted)]">
        <Link href="/categories" className="text-crypto-blue hover:underline">
          All categories
        </Link>
        {" · "}
        <Link href="/signals" className="text-crypto-blue hover:underline">
          View all signals
        </Link>
        {" · "}
        <Link href="/opportunities" className="text-crypto-blue hover:underline">
          Opportunities
        </Link>
      </p>
    </div>
  );
}
