/** Category slug -> one-paragraph description (similar to coin page). */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "smart-contract-platform":
    "Smart contract platforms are blockchain networks that support programmable, self-executing agreements. These L1 and L2 networks enable dApps, DeFi protocols, NFTs, and other on-chain applications. Leading platforms include Ethereum, Solana, BNB Chain, and Avalanche.",
  "layer-1":
    "Layer 1 (L1) blockchains are base networks that process and finalize transactions. They provide security, decentralization, and programmability for the ecosystem built on top. Major L1s include Bitcoin, Ethereum, Solana, and Avalanche.",
  "layer-2":
    "Layer 2 (L2) solutions scale Ethereum and other L1s by moving computation off-chain while preserving security. Common approaches include optimistic rollups, ZK rollups, and sidechains. Examples: Arbitrum, Optimism, Base, Polygon.",
  "stablecoins":
    "Stablecoins are crypto assets designed to maintain a stable value, typically pegged to fiat currencies like the US dollar. They enable trading, lending, and payments without volatility. Major types include fiat-backed (USDT, USDC), algorithmic, and crypto-collateralized.",
  "proof-of-work":
    "Proof of Work (PoW) blockchains secure the network through computational mining. Miners compete to solve puzzles and add blocks; the longest chain wins. Bitcoin and several other chains use PoW for consensus.",
  "proof-of-stake":
    "Proof of Stake (PoS) blockchains secure the network through staked assets. Validators lock tokens to participate; rewards and penalties incentivize honest behavior. Ethereum, Solana, and Cardano use PoS.",
  "decentralized-exchange-dex":
    "Decentralized exchanges (DEXs) allow peer-to-peer trading without intermediaries. Liquidity is pooled; users swap via smart contracts. Leading DEX tokens include Uniswap, Curve, dYdX, and PancakeSwap.",
  "decentralized-finance-defi":
    "DeFi (Decentralized Finance) protocols replicate traditional financial services on-chain: lending, borrowing, trading, and yield. Built on smart contract platforms, DeFi aims for permissionless, transparent financial infrastructure.",
  "artificial-intelligence-ai":
    "AI tokens are crypto assets linked to artificial intelligence projects. They power AI-driven dApps, data marketplaces, compute networks, and agent-based systems. Examples include Fetch.ai, Bittensor, and SingularityNET.",
  "artificial-intelligence":
    "AI tokens are crypto assets linked to artificial intelligence projects. They power AI-driven dApps, data marketplaces, compute networks, and agent-based systems.",
  infrastructure:
    "Infrastructure tokens support core blockchain services: oracles, indexing, storage, identity, and interoperability. They enable dApps to access off-chain data and cross-chain functionality.",
  "solana-ecosystem":
    "The Solana ecosystem includes tokens built on or integrated with the Solana blockchain. It covers DeFi, NFTs, gaming, and consumer apps leveraging Solana’s high throughput and low fees.",
  "ethereum-ecosystem":
    "The Ethereum ecosystem encompasses tokens, dApps, and protocols built on Ethereum or its L2s. It includes DeFi, NFTs, DAOs, and infrastructure projects that rely on Ethereum’s security and composability.",
  gaming:
    "Gaming tokens power blockchain-based games, metaverses, and play-to-earn economies. They are used for in-game assets, governance, and rewards across Web3 gaming platforms.",
  meme:
    "Meme coins are community-driven tokens inspired by internet culture. While often speculative, some gain significant market cap and liquidity. Examples include Dogecoin and Shiba Inu.",
  "proof-of-work-pow":
    "Proof of Work (PoW) blockchains secure the network through computational mining. Bitcoin and several other chains use PoW for consensus.",
  "proof-of-stake-pos":
    "Proof of Stake (PoS) blockchains secure the network through staked assets. Ethereum, Solana, and Cardano use PoS.",
  "decentralized-exchange-(dex)":
    "Decentralized exchanges (DEXs) allow peer-to-peer trading without intermediaries. Liquidity is pooled; users swap via smart contracts.",
  defi:
    "DeFi (Decentralized Finance) protocols replicate traditional financial services on-chain: lending, borrowing, trading, and yield.",
  "artificial-intelligence-(ai)":
    "AI tokens are crypto assets linked to artificial intelligence projects. They power AI-driven dApps, data marketplaces, and compute networks.",
  "gaming-tokens":
    "Gaming tokens power blockchain-based games, metaverses, and play-to-earn economies.",
  "meme-coins":
    "Meme coins are community-driven tokens inspired by internet culture. Examples include Dogecoin and Shiba Inu.",
  "depin-tokens":
    "DePIN (Decentralized Physical Infrastructure) tokens power networks for storage, compute, wireless, and sensors.",
  depin:
    "DePIN (Decentralized Physical Infrastructure) tokens power networks for storage, compute, and sensors.",
  "layer2-tokens":
    "Layer 2 tokens represent assets and protocols built on scaling solutions like Arbitrum, Optimism, Base, and Polygon.",
  "real-world-assets-rwa":
    "Real World Asset (RWA) tokens represent tokenized physical or traditional financial assets on-chain.",
  "liquid-staking-derivatives":
    "Liquid staking derivatives (LSDs) allow stakers to earn rewards while keeping their assets liquid.",
  "yield-bearing-stablecoins":
    "Yield-bearing stablecoins combine stable value with staking or lending yields.",
  "nft-tokens":
    "NFT tokens power NFT marketplaces, collections, and infrastructure for digital collectibles.",
  "tokenized-gold":
    "Tokenized gold tokens represent physical gold on-chain, enabling fractional ownership.",
  bridges:
    "Bridge tokens enable cross-chain asset transfers between different blockchains.",
};

/** Returns description for a category; fallback when none exists. */
export function getCategoryDescription(slug: string, title: string): string {
  const key = slug.toLowerCase();
  const direct = CATEGORY_DESCRIPTIONS[key] ?? CATEGORY_DESCRIPTIONS[slug];
  if (direct) return direct;
  return `Explore ${title} tokens. This category includes crypto assets related to ${title.toLowerCase()}, with market data, signals, and opportunities.`;
}
