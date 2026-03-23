"""
OHLCV chart service: Coinbase → Binance.US → CoinGecko.
Returns normalized [{ time, open, high, low, close, volume }].
"""

from __future__ import annotations

import logging
from typing import Any

from app.services.connectors.chart_cache import chart_cache_get, chart_cache_set

logger = logging.getLogger(__name__)

# Timeframe → (granularity_seconds, limit, cache_ttl)
TIMEFRAME_CONFIG = {
    "1m": (60, 200, 30),
    "5m": (300, 200, 60),
    "15m": (900, 200, 120),
    "1h": (3600, 200, 300),
    "4h": (14400, 200, 600),
    "1d": (86400, 200, 900),
    "1w": (604800, 200, 900),
}

OHLCVRecord = dict[str, Any]

# Symbol/slug -> CoinGecko id for fallback
_SYMBOL_TO_COINGECKO: dict[str, str] = {
    "btc": "bitcoin", "bitcoin": "bitcoin",
    "eth": "ethereum", "ethereum": "ethereum",
    "sol": "solana", "solana": "solana",
    "bnb": "binancecoin", "binancecoin": "binancecoin",
    "xrp": "ripple", "ripple": "ripple",
    "ada": "cardano", "cardano": "cardano",
    "doge": "dogecoin", "dogecoin": "dogecoin",
    "avax": "avalanche-2", "avalanche-2": "avalanche-2",
    "link": "chainlink", "chainlink": "chainlink",
    "dot": "polkadot", "polkadot": "polkadot",
    "matic": "matic-network", "matic-network": "matic-network",
    "uni": "uniswap", "uniswap": "uniswap",
    "atom": "cosmos", "cosmos": "cosmos",
    "ltc": "litecoin", "litecoin": "litecoin",
    "xmr": "monero", "monero": "monero",
}


def _ohlcv_cache_get(key: str) -> list[OHLCVRecord] | None:
    raw = chart_cache_get(key)
    if raw and isinstance(raw, dict) and "ohlcv" in raw:
        return raw.get("ohlcv")
    return None


def _ohlcv_cache_set(key: str, data: list[OHLCVRecord], ttl: int) -> None:
    chart_cache_set(key, {"ohlcv": data}, ttl)


def get_ohlcv(symbol: str, timeframe: str, limit: int = 200) -> list[OHLCVRecord]:
    """
    Fetch OHLCV data. Priority: Coinbase → Binance.US → CoinGecko.
    symbol: base ticker (BTC, ETH, SOL) or slug (bitcoin, ethereum).
    timeframe: 1m, 5m, 15m, 1h, 4h, 1d, 1w
    Returns [{ time, open, high, low, close, volume }] sorted by time asc.
    """
    tf = (timeframe or "1h").lower().strip()
    config = TIMEFRAME_CONFIG.get(tf, TIMEFRAME_CONFIG["1h"])
    granularity_sec, default_limit, ttl = config
    limit = min(limit or default_limit, 500)

    sym_upper = (symbol or "").upper().strip()
    sym_lower = (symbol or "").lower().strip()
    cache_key = f"ohlcv:{sym_upper}:{tf}:{limit}"

    cached = _ohlcv_cache_get(cache_key)
    if cached:
        return cached

    # 1) Coinbase
    data = _fetch_coinbase_ohlcv(sym_upper, granularity_sec, limit)
    if data:
        _ohlcv_cache_set(cache_key, data, ttl)
        return data

    # 2) Binance.US
    data = _fetch_binance_ohlcv(sym_upper, sym_lower, tf, granularity_sec, limit)
    if data:
        _ohlcv_cache_set(cache_key, data, ttl)
        return data

    # 3) CoinGecko (close-only, synthesize OHLC)
    cg_id = _SYMBOL_TO_COINGECKO.get(sym_lower, sym_lower)
    data = _fetch_coingecko_ohlcv(cg_id, tf, limit)
    if data:
        _ohlcv_cache_set(cache_key, data, ttl)
        return data

    logger.warning("All chart providers failed for %s %s", symbol, timeframe)
    return []


def _fetch_coinbase_ohlcv(symbol: str, granularity: int, limit: int) -> list[OHLCVRecord] | None:
    """Coinbase Exchange API: /products/{pair}/candles."""
    from app.services.connectors.coinbase_connector import fetch_candles

    candles = fetch_candles(symbol, granularity, limit)
    if not candles:
        return None
    return [
        {"time": c["time"], "open": c["open"], "high": c["high"], "low": c["low"], "close": c["close"], "volume": c.get("volume", 0)}
        for c in candles
    ]


def _fetch_binance_ohlcv(
    symbol: str, symbol_lower: str, timeframe: str, granularity_sec: int, limit: int
) -> list[OHLCVRecord] | None:
    """Binance.US klines API."""
    from app.services.connectors.binance_us_connector import fetch_klines_ohlcv, slug_to_binance_symbol

    bn_symbol = symbol if len(symbol) <= 5 else slug_to_binance_symbol(symbol_lower) or symbol
    klines = fetch_klines_ohlcv(bn_symbol, timeframe, limit)
    if not klines:
        return None
    return [
        {"time": k["time"], "open": k["open"], "high": k["high"], "low": k["low"], "close": k["close"], "volume": k.get("volume", 0)}
        for k in klines
    ]


def _fetch_coingecko_ohlcv(symbol: str, timeframe: str, limit: int) -> list[OHLCVRecord] | None:
    """CoinGecko market_chart returns close-only; synthesize OHLC from consecutive pairs."""
    from app.services.connectors.coingecko_connector import fetch_market_chart_for_ohlc

    result = fetch_market_chart_for_ohlc(symbol, timeframe, limit)
    if not result:
        return None
    prices, volumes = result
    if not prices or len(prices) < 2:
        return None
    vol_map = {p[0]: p[1] for p in (volumes or [])}
    out: list[OHLCVRecord] = []
    for i in range(len(prices) - 1):
        ts_ms, o = prices[i][0], prices[i][1]
        _, c = prices[i + 1][0], prices[i + 1][1]
        ts_sec = int(ts_ms) // 1000  # lightweight-charts expects seconds
        h, l = max(o, c), min(o, c)
        vol = vol_map.get(ts_ms, 0) or vol_map.get(prices[i + 1][0], 0)
        out.append({"time": ts_sec, "open": o, "high": h, "low": l, "close": c, "volume": vol})
    return out
