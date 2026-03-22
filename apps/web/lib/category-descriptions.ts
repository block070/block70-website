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
  "world-liberty-financial-portfolio":
    "Tokens in the World Liberty Financial portfolio, spanning stablecoins, DeFi, and related assets.",
  "made-in-usa":
    "Crypto projects with significant US presence, adoption, or regulatory focus.",
  "usd-stablecoin":
    "USD-pegged stablecoins designed to maintain a 1:1 value with the US dollar.",
  "fiat-backed-stablecoin":
    "Stablecoins backed by fiat reserves (cash, treasuries) held by custodians.",
  "exchange-based-tokens":
    "Tokens issued by or closely tied to centralized and decentralized exchanges.",
  "made-in-china":
    "Crypto projects with significant China or Asia presence and adoption.",
  "alleged-sec-securities":
    "Tokens that have been subject to SEC enforcement or securities classification discussions.",
  "base-native":
    "Tokens native to the Base L2 ecosystem and its applications.",
  "centralized-exchange-token-cex":
    "Tokens issued by centralized exchanges (CEX) for fees, governance, and rewards.",
  "mica-compliant-stablecoin":
    "Stablecoins designed to comply with the EU MiCA regulatory framework.",
  "coinlist-launchpad":
    "Tokens launched via the CoinList platform for compliant token sales.",
  "meme-token":
    "Meme coins are community-driven tokens inspired by internet culture.",
  governance:
    "Governance tokens that grant voting rights and control over protocols.",
  "dog-themed-coins":
    "Tokens themed around dogs, from Dogecoin to Shiba Inu and newer meme coins.",
  "decentralized-exchange":
    "DEX tokens power peer-to-peer trading without intermediaries.",
  "binance-alpha-spotlight":
    "Tokens highlighted in Binance Alpha Spotlight for emerging opportunities.",
  "4chan-themed":
    "Meme tokens inspired by 4chan culture and communities.",
  "tokenized-private-credit":
    "Tokenized private credit instruments representing on-chain lending.",
  "elon-musk-inspired-coins":
    "Tokens associated with or inspired by Elon Musk and his public statements.",
  "decentralized-perpetuals":
    "Perpetuals trading protocols enabling leveraged positions without expiry.",
  "tokenized-products":
    "Tokenized representations of real-world products and commodities.",
  "decentralized-derivatives":
    "On-chain derivatives for perpetuals, options, and structured products.",
  "yzi-labs-portfolio":
    "Tokens in the YZi Labs (formerly Binance Labs) portfolio.",
  "privacy-coins":
    "Privacy-focused cryptocurrencies designed for confidential transactions.",
  "bitcoin-fork":
    "Tokens derived from Bitcoin through hard forks (e.g. BCH, BSV, XEC).",
  "chain-abstraction":
    "Infrastructure for abstracting chain-specific complexity in multi-chain apps.",
  "privacy-blockchain":
    "Blockchains built with privacy and confidentiality as core features.",
  "rwa-protocol":
    "Protocols tokenizing real-world assets (RWA) on-chain.",
  "privacy-infrastructure":
    "Infrastructure enabling privacy-preserving transactions and identity.",
  "synthetic-dollar":
    "Algorithmic or collateralized synthetic dollar stablecoins.",
  "trump-affiliated-tokens":
    "Tokens associated with or inspired by Trump-related themes.",
  "cross-chain-communication":
    "Protocols enabling messaging and asset transfers across chains.",
  "stablecoin-issuer":
    "Tokens from entities that issue or manage stablecoins.",
  "crypto-backed-stablecoin":
    "Stablecoins collateralized by crypto assets (e.g. DAI, GHO).",
  "superchain-ecosystem":
    "The Optimism Superchain ecosystem and its L2 networks.",
  oracle:
    "Oracle tokens power data feeds that connect blockchains to off-chain information.",
  "x402-ecosystem":
    "Tokens in the x402 ecosystem for AI and HTTP payment protocols.",
  "yield-farming":
    "Tokens from yield farming and liquidity provision protocols.",
  "non-fungible-tokens-nft":
    "NFT marketplace, collection, and infrastructure tokens.",
  "binance-launchpool":
    "Tokens from Binance Launchpool staking and launch programs.",
  "tokenized-commodities":
    "Tokenized commodities such as gold, silver, and energy.",
  "layer-0-l0":
    "Layer 0 (L0) protocols for interoperability and consensus across chains.",
  "automated-market-maker-amm":
    "AMM tokens power automated liquidity and swap protocols.",
  "directed-acyclic-graph-dag":
    "DAG-based networks for high-throughput consensus (e.g. Hedera, Kaspa).",
  "tokenized-t-bills":
    "Tokenized US Treasury and government securities.",
  "defi-pulse-index-dpi":
    "Index tokens tracking DeFi blue chips and protocols.",
  gambling:
    "GambleFi and gaming tokens for on-chain betting and gaming.",
  "quantum-resistant":
    "Cryptographic schemes designed to resist quantum computing attacks.",
  "prediction-markets":
    "Tokens for prediction markets and decentralized forecasting.",
  "crypto-card-issuer":
    "Tokens from crypto card and payment providers.",
  "decentralized-options":
    "On-chain options protocols for derivatives trading.",
  "solana-meme-coins":
    "Meme coins native to the Solana ecosystem.",
  "lending-borrowing":
    "Lending and borrowing protocol tokens (e.g. Aave, Morpho).",
  neobank:
    "Neobank and fintech tokens for crypto-native banking.",
  wallets:
    "Wallet and custody infrastructure tokens.",
  "ai-agents":
    "AI agent and autonomous agent protocol tokens.",
  "payment-solutions":
    "Payment and remittance protocol tokens.",
  metaverse:
    "Metaverse and virtual world platform tokens.",
  "binance-hodler-airdrops":
    "Tokens from Binance HODLer airdrop campaigns.",
  "data-availability":
    "Data availability layer tokens for rollups and L2s.",
  "play-to-earn":
    "Play-to-earn and GameFi tokens.",
  "binance-wallet-ido":
    "Tokens from Binance Wallet IDO launches.",
  "frog-themed-coins":
    "Frog-themed meme coins (e.g. Pepe).",
  "mobile-mining":
    "Mobile and consumer mining protocol tokens.",
  socialfi:
    "SocialFi and decentralized social network tokens.",
  "the-boy-s-club":
    "Meme token community and culture.",
  "yield-bearing-tokens":
    "Yield-bearing and staked asset tokens.",
  storage:
    "Decentralized storage network tokens (e.g. Filecoin, Arweave).",
  identity:
    "Identity and DID (Decentralized Identifier) protocol tokens.",
  rollup:
    "Rollup and L2 scaling solution tokens.",
  "pump-fun":
    "Pump.fun ecosystem and meme launch tokens.",
  "liquid-staking":
    "Liquid staking derivative tokens (e.g. stETH, rETH).",
  "ai-framework":
    "AI framework and infrastructure tokens.",
  "us-treasury-backed-stablecoin":
    "Stablecoins backed by US Treasury securities.",
  "internet-of-things-iot":
    "IoT and machine economy tokens.",
  "ai-agent-launchpad":
    "AI agent launchpad and incubation tokens.",
  analytics:
    "Analytics and data platform tokens.",
  "ai-applications":
    "AI application and consumer AI tokens.",
  "bittensor-subnets":
    "Bittensor subnet and TAO ecosystem tokens.",
  masternodes:
    "Masternode and governance network tokens.",
  sidechain:
    "Sidechain and application-specific chain tokens.",
  "gaming-blockchains":
    "Gaming-focused blockchain and L2 tokens.",
};

/** Returns description for a category; fallback when none exists. */
export function getCategoryDescription(slug: string, title: string): string {
  const key = slug.toLowerCase();
  const direct = CATEGORY_DESCRIPTIONS[key] ?? CATEGORY_DESCRIPTIONS[slug];
  if (direct) return direct;
  return `Explore ${title} tokens. This category includes crypto assets related to ${title.toLowerCase()}, with market data, signals, and opportunities.`;
}
