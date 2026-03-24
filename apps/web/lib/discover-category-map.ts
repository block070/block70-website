/**
 * Discover URL segment -> display title (aligned with CoinGecko category ids).
 * Used by /discover/[category] and to resolve links from API category strings.
 */
export const DISCOVER_SLUG_TO_TITLE: Record<string, string> = {
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
  l1: "Layer 1s",
  infra: "Infrastructure",
  "store-of-value": "Store of Value",
  "ai-big-data": "AI & Big Data",
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

function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

const _titleToSlug = new Map<string, string>();
for (const [slug, title] of Object.entries(DISCOVER_SLUG_TO_TITLE)) {
  const k = normalizeTitle(title);
  if (!_titleToSlug.has(k)) {
    _titleToSlug.set(k, slug);
  }
}

/**
 * Map a CoinGecko coin category label (e.g. from API `category`) to a /discover/[slug]
 * segment when `category_slug` is not stored yet.
 */
export function discoverSlugFromCategoryLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const n = normalizeTitle(label);
  const hit = _titleToSlug.get(n);
  if (hit) return hit;
  const stripped = n.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (stripped !== n) {
    return _titleToSlug.get(stripped) ?? null;
  }
  return null;
}
