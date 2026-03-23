"""
Binance.US API connector – primary price source, no auth.

Public market data (security type NONE) – allowed for US-based sites.
GET /api/v3/ticker/price returns all trading pairs in one call.
"""

from __future__ import annotations

import logging
from typing import Dict, Optional

import requests

logger = logging.getLogger(__name__)

BINANCE_US_BASE = "https://api.binance.us/api/v3"

# CoinGecko id/symbol -> Binance.US symbol (BASE+USD, no hyphen)
_SYMBOL_TO_BINANCE: dict[str, str] = {
    "bitcoin": "BTCUSD",
    "btc": "BTCUSD",
    "ethereum": "ETHUSD",
    "eth": "ETHUSD",
    "solana": "SOLUSD",
    "sol": "SOLUSD",
    "tether": "USDTUSD",
    "usdt": "USDTUSD",
    "usdc": "USDCUSD",
    "bnb": "BNBUSD",
    "xrp": "XRPUSD",
    "cardano": "ADAUSD",
    "ada": "ADAUSD",
    "avalanche-2": "AVAXUSD",
    "avax": "AVAXUSD",
    "dogecoin": "DOGEUSD",
    "doge": "DOGEUSD",
    "polkadot": "DOTUSD",
    "dot": "DOTUSD",
    "polygon": "MATICUSD",
    "matic": "MATICUSD",
    "chainlink": "LINKUSD",
    "link": "LINKUSD",
    "shiba-inu": "SHIBUSD",
    "shib": "SHIBUSD",
    "uniswap": "UNIUSD",
    "uni": "UNIUSD",
    "litecoin": "LTCUSD",
    "ltc": "LTCUSD",
    "tron": "TRXUSD",
    "trx": "TRXUSD",
    "sui": "SUIUSD",
    "near": "NEARUSD",
    "aptos": "APTUSD",
    "apt": "APTUSD",
    "arbitrum": "ARBUSD",
    "arb": "ARBUSD",
    "optimism": "OPUSD",
    "op": "OPUSD",
    "render-token": "RENDERUSD",
    "render": "RENDERUSD",
    "sei-network": "SEIUSD",
    "sei": "SEIUSD",
    "bonk": "BONKUSD",
    "pepe": "PEPEUSD",
    "wrapped-bitcoin": "WBTCUSD",
    "wbtc": "WBTCUSD",
    "filecoin": "FILUSD",
    "fil": "FILUSD",
    "aave": "AAVEUSD",
    "cosmos": "ATOMUSD",
    "atom": "ATOMUSD",
    "the-graph": "GRTUSD",
    "grt": "GRTUSD",
    "stacks": "STXUSD",
    "stx": "STXUSD",
}


def get_all_prices_usd() -> Dict[str, float]:
    """
    Fetch all USD-denominated prices in one API call.
    GET /api/v3/ticker/price returns all pairs.
    Filter to *USD pairs and extract base symbol.
    """
    out: Dict[str, float] = {}
    try:
        url = f"{BINANCE_US_BASE}/ticker/price"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict):
            data = [data]
        for item in data or []:
            sym = (item.get("symbol") or "").upper()
            if not sym or not sym.endswith("USD") or sym == "USD":
                continue
            base = sym[:-3]
            if not base:
                continue
            try:
                price = float(item.get("price", 0))
                if price > 0:
                    out[base] = price
            except (TypeError, ValueError):
                pass
    except Exception as e:
        logger.warning("Binance.US ticker/price failed: %s", e)
    return out


def get_spot_price(symbol: str) -> Optional[float]:
    """
    Fetch spot price for one symbol. symbol: ticker (BTC, SOL) or coingecko id.
    """
    sym = (symbol or "").lower().strip()
    binance_sym = _SYMBOL_TO_BINANCE.get(sym)
    if not binance_sym:
        return None
    try:
        url = f"{BINANCE_US_BASE}/ticker/price"
        resp = requests.get(url, params={"symbol": binance_sym}, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        price = data.get("price")
        if price is not None:
            return float(price)
    except Exception as e:
        logger.debug("Binance.US spot price failed for %s: %s", symbol, e)
    return None


def get_btc_price_usd() -> Optional[float]:
    """Convenience: BTC price in USD."""
    return get_spot_price("bitcoin")


def get_sol_price_usd() -> Optional[float]:
    """Convenience: SOL price in USD."""
    return get_spot_price("solana")
