"""
Unified price resolver – tries Coinbase, Binance.US, then CoinGecko.
"""

from __future__ import annotations

import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


def get_btc_price_usd() -> Optional[float]:
    """BTC price: Coinbase → Binance.US → CoinGecko."""
    from app.services.connectors.coinbase_connector import get_btc_price_usd as cb
    from app.services.connectors.binance_us_connector import get_btc_price_usd as bn

    price = cb()
    if price and price > 0:
        return price
    price = bn()
    if price and price > 0:
        return price
    try:
        import requests

        resp = requests.get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={"ids": "bitcoin", "vs_currencies": "usd"},
            timeout=5,
        )
        resp.raise_for_status()
        p = (resp.json().get("bitcoin") or {}).get("usd")
        if p is not None:
            return float(p)
    except Exception as e:
        logger.debug("CoinGecko BTC fallback failed: %s", e)
    return None


def get_sol_price_usd() -> Optional[float]:
    """SOL price: Coinbase → Binance.US → CoinGecko."""
    from app.services.connectors.coinbase_connector import get_sol_price_usd as cb
    from app.services.connectors.binance_us_connector import get_sol_price_usd as bn

    price = cb()
    if price and price > 0:
        return price
    price = bn()
    if price and price > 0:
        return price
    try:
        import requests

        resp = requests.get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={"ids": "solana", "vs_currencies": "usd"},
            timeout=5,
        )
        resp.raise_for_status()
        p = (resp.json().get("solana") or {}).get("usd")
        if p is not None:
            return float(p)
    except Exception as e:
        logger.debug("CoinGecko SOL fallback failed: %s", e)
    return None


def get_all_prices_usd() -> Dict[str, float]:
    """
    All crypto prices. Merges Coinbase + Binance.US (Binance fills gaps).
    One call each – no CoinGecko for bulk.
    """
    from app.services.connectors.coinbase_connector import get_all_prices_usd as cb_all
    from app.services.connectors.binance_us_connector import get_all_prices_usd as bn_all

    out: Dict[str, float] = {}
    cb = cb_all()
    bn = bn_all()
    for k, v in cb.items():
        if v and v > 0:
            out[k] = v
    for k, v in bn.items():
        if v and v > 0 and k not in out:
            out[k] = v
    return out
