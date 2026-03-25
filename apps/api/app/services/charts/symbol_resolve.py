"""Map URL slugs / symbols to exchange tickers for OHLCV fetchers."""

from __future__ import annotations

# CoinGecko-style slug → base asset ticker (Binance USDT pair)
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
    "aptos": "APT",
    "arbitrum": "ARB",
    "optimism": "OP",
    "shiba-inu": "SHIB",
    "wrapped-steth": "WSTETH",
}


def guess_ticker(sym_upper: str, sym_lower: str) -> str:
    """Best-effort ticker for Binance/Coinbase-style APIs."""
    u = (sym_upper or "").strip().upper()
    low = (sym_lower or "").strip().lower()
    if 2 <= len(u) <= 6 and u.isalpha():
        return u
    return SLUG_TO_TICKER.get(low, u[:6] if u.isalnum() else "BTC")
