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


# Timeframe to Binance interval
_TF_TO_INTERVAL: dict[str, str] = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
    "1w": "1w",
}


def fetch_klines_ohlcv(
    symbol: str,
    timeframe: str,
    limit: int = 200,
) -> Optional[list[dict]]:
    """
    Fetch OHLCV from Binance.US klines.
    Returns [{ time, open, high, low, close, volume }] or None.
    """
    sym = (symbol or "").upper().strip()
    interval = _TF_TO_INTERVAL.get((timeframe or "1h").lower(), "1h")
    if not sym:
        return None
    for quote in ("USDT", "USD"):
        binance_sym = f"{sym}{quote}"
        try:
            url = f"{BINANCE_US_BASE}/klines"
            params = {"symbol": binance_sym, "interval": interval, "limit": limit}
            resp = requests.get(url, params=params, timeout=10)
            if resp.status_code != 200:
                continue
            data = resp.json()
            if not isinstance(data, list) or not data:
                continue
            out = []
            for c in data:
                if len(c) >= 6:
                    out.append({
                        "time": int(c[0]) // 1000,  # ms -> seconds for lightweight-charts
                        "open": float(c[1]),
                        "high": float(c[2]),
                        "low": float(c[3]),
                        "close": float(c[4]),
                        "volume": float(c[5]),
                    })
            return out
        except Exception as e:
            logger.debug("Binance.US klines %s failed: %s", binance_sym, e)
    return None


def fetch_klines_chart(symbol: str, days: int = 7) -> Optional[list]:
    """
    Fetch historical chart from Binance.US klines.
    Returns [[timestamp_ms, price], ...] in CoinGecko format, or None.
    symbol: base ticker (BTC, ETH, XMR) - will try XXXUSDT, XXXUSD.
    """
    sym = (symbol or "").upper().strip()
    if not sym:
        return None
    for quote in ("USDT", "USD"):
        binance_sym = f"{sym}{quote}"
        try:
            url = f"{BINANCE_US_BASE}/klines"
            interval = "1h" if days <= 1 else "1d"
            limit = min(days * 24 if days <= 1 else days, 1000)
            params = {"symbol": binance_sym, "interval": interval, "limit": limit}
            resp = requests.get(url, params=params, timeout=10)
            if resp.status_code != 200:
                continue
            data = resp.json()
            if not isinstance(data, list) or not data:
                continue
            # Klines: [open_time, open, high, low, close, volume, ...]
            prices = [[int(c[0]), float(c[4])] for c in data]
            return prices
        except Exception as e:
            logger.debug("Binance.US klines %s failed: %s", binance_sym, e)
    return None


# CoinGecko slug -> Binance base symbol (for charts when Binance has the pair)
_COINGECKO_SLUG_TO_BINANCE: dict[str, str] = {
    "bitcoin": "BTC",
    "ethereum": "ETH",
    "solana": "SOL",
    "tether": "USDT",
    "binancecoin": "BNB",
    "ripple": "XRP",
    "cardano": "ADA",
    "dogecoin": "DOGE",
    "avalanche-2": "AVAX",
    "chainlink": "LINK",
    "polkadot": "DOT",
    "matic-network": "MATIC",
    "polygon": "MATIC",
    "uniswap": "UNI",
    "cosmos": "ATOM",
    "litecoin": "LTC",
    "tron": "TRX",
    "sui": "SUI",
    "near": "NEAR",
    "aptos": "APT",
    "arbitrum": "ARB",
    "optimism": "OP",
    "filecoin": "FIL",
    "aave": "AAVE",
    "the-graph": "GRT",
    "stacks": "STX",
    "render-token": "RENDER",
    "sei-network": "SEI",
    "bonk": "BONK",
    "pepe": "PEPE",
    "shiba-inu": "SHIB",
    "stellar": "XLM",
    "algorand": "ALGO",
    "vechain": "VET",
    "internet-computer": "ICP",
    "hedera-hashgraph": "HBAR",
    "theta-network": "THETA",
    "mantle": "MNT",
    "immutable-x": "IMX",
    "flow": "FLOW",
    "elrond-egld": "EGLD",
    "axie-infinity": "AXS",
    "the-sandbox": "SAND",
    "decentraland": "MANA",
}


def slug_to_binance_symbol(slug: str) -> Optional[str]:
    """Map CoinGecko slug to Binance base symbol for chart fallback."""
    return _COINGECKO_SLUG_TO_BINANCE.get((slug or "").lower().strip())
