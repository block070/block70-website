"""
CoinMarketCap API connector for cryptocurrency listings.

Used as fallback when CoinGecko returns empty (e.g. pages 6+ on free tier).
Requires CMC_API_KEY env var. Free tier: ~30 req/min, 10k credits/mo.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

import requests

logger = logging.getLogger(__name__)

CMC_API_BASE = os.getenv("CMC_API_BASE", "https://pro-api.coinmarketcap.com/v1")


def _get(path: str, params: Dict[str, Any] | None = None) -> Any:
    api_key = os.getenv("CMC_API_KEY", "").strip()
    if not api_key:
        raise ValueError("CMC_API_KEY not configured")

    url = f"{CMC_API_BASE}{path}"
    headers = {"X-CMC_PRO_API_KEY": api_key, "Accept": "application/json"}
    resp = requests.get(url, params=params or {}, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json()


def fetch_listings_latest(start: int = 1, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Fetch paginated listings from CoinMarketCap cryptocurrency/listings/latest.
    Returns normalized list compatible with our CoinListItem shape.
    start: 1-based rank (1 = first, 101 = page 2, etc.)
    limit: max 5000, we use 100 per page.
    """
    data = _get(
        "/cryptocurrency/listings/latest",
        params={"start": start, "limit": limit, "convert": "USD"},
    )
    raw_list = data.get("data") or []
    return [normalize_listing(item) for item in raw_list]


def normalize_listing(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Map CMC listing to our common shape (slug, name, symbol, price, etc.)."""
    quote = (raw.get("quote") or {}).get("USD") or {}
    return {
        "slug": raw.get("slug") or str(raw.get("id", "")),
        "name": raw.get("name") or "",
        "symbol": (raw.get("symbol") or "").upper(),
        "market_cap_rank": raw.get("cmc_rank"),
        "market_cap": quote.get("market_cap"),
        "price": quote.get("price"),
        "volume_24h": quote.get("volume_24h"),
        "price_change_24h": quote.get("percent_change_24h"),
        "price_change_7d": quote.get("percent_change_7d"),
        "circulating_supply": raw.get("circulating_supply"),
        "total_supply": raw.get("total_supply"),
        "logo_url": _logo_from_platform(raw),
    }


def _logo_from_platform(raw: Dict[str, Any]) -> str | None:
    """Extract logo URL from CMC response. logo is optional in free tier."""
    # CMC may return logo in different places
    logo = raw.get("logo")
    if logo and isinstance(logo, str):
        return logo
    # Some plans include logo in metadata
    return None
