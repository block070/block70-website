"""
CoinMarketCap API connector for cryptocurrency listings.

Used as fallback when CoinGecko returns empty (e.g. pages 6+ on free tier).
Requires CMC_API_KEY env var. Free tier: ~30 req/min, 10k credits/mo.
Basic tier may limit listings to start <= 1000; we batch-fetch when needed.
"""

from __future__ import annotations

import logging
import time
import os
from typing import Any, Dict, List

import requests

logger = logging.getLogger(__name__)

CMC_API_BASE = os.getenv("CMC_API_BASE", "https://pro-api.coinmarketcap.com/v1")
CMC_BATCH_DELAY = float(os.getenv("CMC_BATCH_DELAY", "2.0"))


def _get(path: str, params: Dict[str, Any] | None = None) -> Any:
    api_key = os.getenv("CMC_API_KEY", "").strip()
    if not api_key:
        raise ValueError("CMC_API_KEY not configured")

    url = f"{CMC_API_BASE}{path}"
    headers = {"X-CMC_PRO_API_KEY": api_key, "Accept": "application/json"}
    resp = requests.get(url, params=params or {}, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json()


def _fetch_one_page(start: int, limit: int) -> List[Dict[str, Any]]:
    """Single CMC request for listings. Returns normalized items."""
    data = _get(
        "/cryptocurrency/listings/latest",
        params={"start": start, "limit": limit, "convert": "USD"},
    )
    raw_list = data.get("data") or []
    return [normalize_listing(item) for item in raw_list]


def fetch_listings_latest(start: int = 1, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Fetch paginated listings from CoinMarketCap cryptocurrency/listings/latest.
    Returns normalized list compatible with our CoinListItem shape.
    When direct request fails or returns empty (some plans limit start), batch-fetch
    from the beginning and slice the requested range.
    """
    try:
        items = _fetch_one_page(start, limit)
        if items:
            return items
    except requests.RequestException as e:
        logger.debug("CMC direct fetch failed for start=%s: %s", start, e)

    # Batch fetch when direct request fails or returns empty
    if start > 1:
        try:
            all_items: List[Dict[str, Any]] = []
            chunk_start = 1
            chunk_size = 100
            needed_end = start + limit - 1
            while len(all_items) < needed_end:
                chunk = _fetch_one_page(chunk_start, chunk_size)
                if not chunk:
                    break
                all_items.extend(chunk)
                if len(chunk) < chunk_size:
                    break
                chunk_start += chunk_size
                if CMC_BATCH_DELAY > 0:
                    time.sleep(CMC_BATCH_DELAY)
            # Slice to requested range (0-based: start-1 to start+limit-1)
            start_idx = start - 1
            return all_items[start_idx : start_idx + limit]
        except requests.RequestException:
            return []

    return []


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
