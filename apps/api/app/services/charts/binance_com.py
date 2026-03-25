"""
Global Binance spot klines (primary OHLCV source for chart packs).
"""

from __future__ import annotations

import logging
from typing import Any

import requests

logger = logging.getLogger(__name__)

BINANCE_COM_KLINES = "https://api.binance.com/api/v3/klines"

# API interval string per our timeframe key
TF_TO_INTERVAL = {
    "1m": "1m",
    "5m": "5m",
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
}

TF_TO_LIMIT = {
    "1m": 300,
    "5m": 288,
    "1h": 200,
    "4h": 200,
    "1d": 200,
}


def to_usdt_pair(ticker: str) -> str:
    t = (ticker or "").upper().replace("/", "").replace("-", "")
    if t.endswith("USDT"):
        return t
    return f"{t}USDT"


def fetch_binance_com_klines(ticker: str, timeframe: str) -> list[dict[str, Any]] | None:
    """Return [{ time, open, high, low, close, volume }] time in seconds, or None."""
    tf = (timeframe or "1h").lower().strip()
    interval = TF_TO_INTERVAL.get(tf)
    if not interval:
        return None
    limit = min(TF_TO_LIMIT.get(tf, 200), 1000)
    sym = to_usdt_pair(ticker)
    try:
        r = requests.get(
            BINANCE_COM_KLINES,
            params={"symbol": sym, "interval": interval, "limit": limit},
            timeout=15,
        )
        if r.status_code == 400:
            logger.debug("Binance.com unsupported pair %s", sym)
            return None
        r.raise_for_status()
        raw = r.json()
    except Exception as e:
        logger.warning("Binance.com klines failed %s: %s", sym, e)
        return None
    if not isinstance(raw, list):
        return None
    out: list[dict[str, Any]] = []
    for row in raw:
        if not isinstance(row, list) or len(row) < 6:
            continue
        try:
            t_ms = int(row[0])
            o, h, low, c = float(row[1]), float(row[2]), float(row[3]), float(row[4])
            vol = float(row[5]) if row[5] else 0.0
        except (TypeError, ValueError):
            continue
        out.append(
            {
                "time": t_ms // 1000,
                "open": o,
                "high": h,
                "low": low,
                "close": c,
                "volume": vol,
            }
        )
    return out if out else None
