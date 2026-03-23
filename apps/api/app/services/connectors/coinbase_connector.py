"""
Coinbase API connector – PRIMARY price source, no auth.

- /v2/exchange-rates?currency=USD: one call for all crypto prices (1 USD = X of each)
- /v2/prices/{pair}/spot: single-pair fallback
"""

from __future__ import annotations

import logging
from typing import Dict, Optional

import requests

logger = logging.getLogger(__name__)

COINBASE_API_BASE = "https://api.coinbase.com/v2"

# Fiat currencies to exclude from get_all_prices_usd()
_FIAT = frozenset({
    "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "HKD", "SGD",
    "KRW", "NOK", "SEK", "DKK", "PLN", "CZK", "HUF", "RUB", "INR", "BRL",
    "MXN", "ARS", "CLP", "COP", "PEN", "AED", "SAR", "ILS", "ZAR", "TRY",
    "BGN", "RON", "UAH", "PHP", "IDR", "THB", "MYR", "VND", "NGN", "EGP",
    "PKR", "BDT", "PAB", "BSD", "BBD", "BMD", "KYD", "GYD", "LRD", "JMD",
    "TTD", "XCD", "BZD", "HTG", "DOP", "CUP", "UYU", "PYG", "BOB", "NIO",
    "CRC", "SVC", "GTQ", "HNL", "NZD", "XAF", "XOF", "XPF", "ALL", "AMD",
    "ANG", "AWG", "AZN", "BAM", "BHD", "BIF", "BND", "BWP", "BYN", "CDF",
    "DJF", "DZD", "ERN", "ETB", "FKP", "GEL", "GHS", "GIP", "GMD", "GNF",
    "IMP", "IQD", "IRR", "ISK", "JEP", "JOD", "KES", "KGS", "KHR", "KMF",
    "KWD", "KZT", "LAK", "LBP", "LKR", "LSL", "LYD", "MAD", "MDL", "MGA",
    "MKD", "MMK", "MNT", "MOP", "MRO", "MRU", "MUR", "MVR", "MWK", "MZN",
    "NAD", "NGN", "NPR", "OMR", "PGK", "QAR", "RSD", "RWF", "SBD", "SCR",
    "SDG", "SHP", "SLL", "SOS", "SRD", "SYP", "SZL", "TJS", "TMT", "TND",
    "TOP", "TWD", "TZS", "UAH", "UGX", "UZS", "VND", "VUV", "WST", "XAF",
    "XCD", "XOF", "XPF", "YER", "ZAR", "ZMW", "ZWL",
})

# CoinGecko id/symbol -> Coinbase product id (base-quote)
_SYMBOL_TO_PAIR: dict[str, str] = {
    "bitcoin": "BTC-USD",
    "btc": "BTC-USD",
    "ethereum": "ETH-USD",
    "eth": "ETH-USD",
    "solana": "SOL-USD",
    "sol": "SOL-USD",
    "tether": "USDT-USD",
    "usdt": "USDT-USD",
    "usdc": "USDC-USD",
    "bnb": "BNB-USD",
    "xrp": "XRP-USD",
    "cardano": "ADA-USD",
    "ada": "ADA-USD",
    "avalanche-2": "AVAX-USD",
    "avax": "AVAX-USD",
    "dogecoin": "DOGE-USD",
    "doge": "DOGE-USD",
    "polkadot": "DOT-USD",
    "dot": "DOT-USD",
    "polygon": "MATIC-USD",
    "matic": "MATIC-USD",
    "chainlink": "LINK-USD",
    "link": "LINK-USD",
    "shiba-inu": "SHIB-USD",
    "shib": "SHIB-USD",
    "uniswap": "UNI-USD",
    "uni": "UNI-USD",
    "litecoin": "LTC-USD",
    "ltc": "LTC-USD",
}


def get_spot_price(symbol: str) -> Optional[float]:
    """
    Fetch current spot price in USD. No auth required.
    symbol: CoinGecko id (e.g. 'bitcoin') or ticker (e.g. 'btc', 'eth', 'sol').
    Returns None if unsupported or fetch fails.
    """
    sym = (symbol or "").lower().strip()
    pair = _SYMBOL_TO_PAIR.get(sym)
    if not pair:
        return None
    try:
        url = f"{COINBASE_API_BASE}/prices/{pair}/spot"
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        amount = data.get("data", {}).get("amount")
        if amount is not None:
            return float(amount)
    except Exception as e:
        logger.debug("Coinbase spot price failed for %s: %s", symbol, e)
    return None


def get_btc_price_usd() -> Optional[float]:
    """Convenience: BTC price in USD."""
    return get_spot_price("bitcoin")


def get_sol_price_usd() -> Optional[float]:
    """Convenience: SOL price in USD."""
    return get_spot_price("solana")


def get_all_prices_usd() -> Dict[str, float]:
    """
    Fetch all crypto prices in USD via one API call.
    GET /v2/exchange-rates?currency=USD → 1 USD = X of each.
    Price in USD = 1/rate. Filters out fiat.
    """
    out: Dict[str, float] = {}
    try:
        url = f"{COINBASE_API_BASE}/exchange-rates"
        resp = requests.get(url, params={"currency": "USD"}, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        rates = (data.get("data") or {}).get("rates") or {}
        for curr, rate_str in rates.items():
            if not curr or curr in _FIAT:
                continue
            try:
                rate = float(rate_str)
                if rate > 0:
                    out[curr.upper()] = 1.0 / rate
            except (TypeError, ValueError):
                pass
    except Exception as e:
        logger.warning("Coinbase exchange-rates failed: %s", e)
    return out


def get_price_usd(symbol: str, all_prices: Optional[Dict[str, float]] = None) -> Optional[float]:
    """
    Get price in USD. Tries all_prices dict first (from get_all_prices_usd),
    then single-pair spot. symbol: ticker (BTC, ETH, SOL) or coingecko id (bitcoin, solana).
    """
    sym = (symbol or "").upper().strip()
    slug = (symbol or "").lower().strip()

    if all_prices and sym in all_prices:
        return all_prices[sym]
    if all_prices:
        cg_to_ticker = {"bitcoin": "BTC", "ethereum": "ETH", "solana": "SOL", "tether": "USDT"}
        t = cg_to_ticker.get(slug)
        if t and t in all_prices:
            return all_prices[t]

    return get_spot_price(symbol)
