"""Map URL slugs / symbols to exchange tickers for OHLCV fetchers."""

from __future__ import annotations

# CoinGecko-style slug → base asset ticker (Binance USDT pair). Expand as needed.
SLUG_TO_TICKER: dict[str, str] = {
    "bitcoin": "BTC",
    "ethereum": "ETH",
    "solana": "SOL",
    "binancecoin": "BNB",
    "ripple": "XRP",
    "cardano": "ADA",
    "dogecoin": "DOGE",
    "avalanche-2": "AVAX",
    "chainlink": "LINK",
    "polkadot": "DOT",
    "matic-network": "MATIC",
    "polygon-ecosystem-token": "MATIC",
    "uniswap": "UNI",
    "cosmos": "ATOM",
    "litecoin": "LTC",
    "monero": "XMR",
    "tron": "TRX",
    "sui": "SUI",
    "near": "NEAR",
    "near-protocol": "NEAR",
    "aptos": "APT",
    "arbitrum": "ARB",
    "optimism": "OP",
    "shiba-inu": "SHIB",
    "wrapped-steth": "WSTETH",
    "curve-dao-token": "CRV",
    "aave": "AAVE",
    "maker": "MKR",
    "lido-dao": "LDO",
    "injective-protocol": "INJ",
    "the-graph": "GRT",
    "fantom": "FTM",
    "render-token": "RNDR",
    "synthetix-network-token": "SNX",
    "pepe": "PEPE",
    "floki": "FLOKI",
    "bonk": "BONK",
    "worldcoin-wld": "WLD",
    "ondo-finance": "ONDO",
    "fetch-ai": "FET",
    "quant-network": "QNT",
    "algorand": "ALGO",
    "filecoin": "FIL",
    "vechain": "VET",
    "hedera-hashgraph": "HBAR",
    "internet-computer": "ICP",
    "theta-token": "THETA",
    "eos": "EOS",
    "tezos": "XTZ",
    "neo": "NEO",
    "dash": "DASH",
    "stellar": "XLM",
    "zcash": "ZEC",
}


def guess_ticker(sym_upper: str, sym_lower: str) -> str:
    """
    Best-effort ticker for Binance USDT klines.

    Returns "" when the input is clearly a CoinGecko-style slug (hyphenated),
    so callers can skip Binance and use CoinGecko OHLC instead of wrong pairs
    or falling back to unrelated tickers.
    """
    u = (sym_upper or "").strip().upper()
    low = (sym_lower or "").strip().lower()
    mapped = SLUG_TO_TICKER.get(low)
    if mapped:
        return mapped
    if "-" in low:
        return ""
    if 2 <= len(u) <= 6 and u.isalpha():
        return u
    return ""
