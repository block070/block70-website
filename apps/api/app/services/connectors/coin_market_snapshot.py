"""
Live coin “header” market fields with **exchange APIs first**, CoinGecko last.

Order matches `app.services.charts.chart_service.get_ohlcv` priority:
1. Binance.com (global spot, USDT/USDC 24h ticker)
2. Coinbase (mapped products — spot price; 24h volume/change often unavailable)
3. Binance.US (USD / USDT 24h ticker)

Returns a dict shaped like a CoinGecko `/coins/markets` row fragment so callers
can merge without a second normalization step. Fields exchanges don’t provide
(`market_cap`, `price_change_percentage_7d_*`) are omitted or None.

Use this for `/coins/{slug}` live refresh before falling back to CoinGecko to
save API quota.
"""

from __future__ import annotations

import logging
from typing import Any

import requests

from app.services.charts.symbol_resolve import guess_ticker

logger = logging.getLogger(__name__)

BINANCE_COM_BASE = "https://api.binance.com/api/v3"
BINANCE_US_BASE = "https://api.binance.us/api/v3"


def _binance_com_24h(ticker: str) -> dict[str, Any] | None:
    t = (ticker or "").upper().strip()
    if not t or len(t) > 20:
        return None
    for quote_suffix in ("USDT", "USDC", "BUSD"):
        sym = f"{t}{quote_suffix}"
        try:
            r = requests.get(
                f"{BINANCE_COM_BASE}/ticker/24hr",
                params={"symbol": sym},
                timeout=8,
            )
            if r.status_code != 200:
                continue
            d = r.json()
            if not isinstance(d, dict):
                continue
            last = float(d.get("lastPrice", 0) or 0)
            if last <= 0:
                continue
            pct = d.get("priceChangePercent")
            try:
                p24 = float(pct) if pct is not None else None
            except (TypeError, ValueError):
                p24 = None
            qv = d.get("quoteVolume")
            try:
                vol = float(qv) if qv is not None else None
            except (TypeError, ValueError):
                vol = None
            return {
                "current_price": last,
                "total_volume": vol,
                "price_change_percentage_24h": p24,
                "price_change_percentage_7d_in_currency": None,
                "market_cap": None,
                "_source": "binance_com",
            }
        except Exception as e:
            logger.debug("binance.com 24hr %s: %s", sym, e)
    return None


def _coinbase_spot_only(slug: str) -> dict[str, Any] | None:
    from app.services.connectors.coinbase_connector import get_spot_price

    s = (slug or "").lower().strip()
    if not s:
        return None
    try:
        px = get_spot_price(s)
        if px is None or px <= 0:
            return None
        return {
            "current_price": float(px),
            "total_volume": None,
            "price_change_percentage_24h": None,
            "price_change_percentage_7d_in_currency": None,
            "market_cap": None,
            "_source": "coinbase",
        }
    except Exception as e:
        logger.debug("coinbase spot %s: %s", s, e)
    return None


def _binance_us_24h(ticker: str) -> dict[str, Any] | None:
    t = (ticker or "").upper().strip()
    if not t or len(t) > 20:
        return None
    for quote_suffix in ("USD", "USDT"):
        sym = f"{t}{quote_suffix}"
        try:
            r = requests.get(
                f"{BINANCE_US_BASE}/ticker/24hr",
                params={"symbol": sym},
                timeout=8,
            )
            if r.status_code != 200:
                continue
            d = r.json()
            if not isinstance(d, dict):
                continue
            last = float(d.get("lastPrice", 0) or 0)
            if last <= 0:
                continue
            pct = d.get("priceChangePercent")
            try:
                p24 = float(pct) if pct is not None else None
            except (TypeError, ValueError):
                p24 = None
            qv = d.get("quoteVolume")
            try:
                vol = float(qv) if qv is not None else None
            except (TypeError, ValueError):
                vol = None
            return {
                "current_price": last,
                "total_volume": vol,
                "price_change_percentage_24h": p24,
                "price_change_percentage_7d_in_currency": None,
                "market_cap": None,
                "_source": "binance_us",
            }
        except Exception as e:
            logger.debug("binance.us 24hr %s: %s", sym, e)
    return None


def fetch_exchange_first_market_snapshot(slug: str, symbol: str | None) -> dict[str, Any] | None:
    """
    Try Binance.com → Coinbase → Binance.US. Returns a CG markets-like dict or None.

    `slug` is CoinGecko-style (e.g. bitcoin). `symbol` is DB ticker (e.g. BTC).
    """
    low = (slug or "").lower().strip()
    sym = (symbol or "").strip()
    u = sym.upper() if sym else ""
    ticker = guess_ticker(u, low)

    row = _binance_com_24h(ticker)
    if row:
        return row

    row = _coinbase_spot_only(low)
    if row:
        return row

    row = _binance_us_24h(ticker)
    if row:
        return row

    return None
