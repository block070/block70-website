from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import requests


COINGECKO_API_BASE = os.getenv("COINGECKO_API_BASE", "https://api.coingecko.com/api/v3")


def _get(path: str, params: Optional[Dict[str, Any]] = None) -> Any:
    url = f"{COINGECKO_API_BASE}{path}"
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


def fetch_all_coins(vs_currency: str = "usd", per_page: int = 250, page: int = 1) -> List[Dict[str, Any]]:
    """
    Fetch a page of coins from CoinGecko's /coins/markets endpoint.

    This is intended for seeding/syncing the Coin table. Pagination and
    filtering (e.g. by category) can be handled by callers.
    """
    data = _get(
        "/coins/markets",
        params={
            "vs_currency": vs_currency,
            "order": "market_cap_desc",
            "per_page": per_page,
            "page": page,
            "sparkline": "false",
            "price_change_percentage": "24h,7d",
        },
    )
    return [normalize_market_coin(item) for item in data]


def fetch_coin_details(coin_id: str, vs_currency: str = "usd") -> Dict[str, Any]:
    """
    Fetch detailed data for a single coin from CoinGecko's /coins/{id} endpoint.
    """
    data = _get(
        f"/coins/{coin_id}",
        params={
            "localization": "false",
            "tickers": "false",
            "market_data": "true",
            "community_data": "true",
            "developer_data": "false",
            "sparkline": "false",
        },
    )
    return normalize_coin_detail(data, vs_currency=vs_currency)


def normalize_market_coin(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize /coins/markets response into the Coin model schema fields.
    """
    return {
        "external_id": raw.get("id"),
        "name": raw.get("name"),
        "symbol": (raw.get("symbol") or "").upper(),
        "slug": raw.get("id"),
        "description": None,
        "logo_url": raw.get("image"),
        "website": None,
        "twitter": None,
        "discord": None,
        "chain": None,
        "category": None,
        "market_cap": raw.get("market_cap"),
        "price": raw.get("current_price"),
        "volume_24h": raw.get("total_volume"),
        "circulating_supply": raw.get("circulating_supply"),
        "total_supply": raw.get("total_supply"),
        "price_change_24h": raw.get("price_change_percentage_24h"),
        "price_change_7d": raw.get("price_change_percentage_7d_in_currency"),
    }


def normalize_coin_detail(raw: Dict[str, Any], vs_currency: str = "usd") -> Dict[str, Any]:
    """
    Normalize /coins/{id} response into Coin + MarketData schema fields.
    """
    market_data = raw.get("market_data") or {}

    current_price = (market_data.get("current_price") or {}).get(vs_currency)
    market_cap = (market_data.get("market_cap") or {}).get(vs_currency)
    volume_24h = (market_data.get("total_volume") or {}).get(vs_currency)

    change_24h = market_data.get("price_change_percentage_24h")
    change_7d = market_data.get("price_change_percentage_7d")

    links = raw.get("links") or {}

    return {
        "coin": {
            "external_id": raw.get("id"),
            "name": raw.get("name"),
            "symbol": (raw.get("symbol") or "").upper(),
            "slug": raw.get("id"),
            "description": (raw.get("description") or {}).get("en") or None,
            "logo_url": (raw.get("image") or {}).get("large"),
            "website": (links.get("homepage") or [None])[0],
            "twitter": links.get("twitter_screen_name"),
            "discord": links.get("chat_url", [None])[0],
            "chain": None,
            "category": (raw.get("categories") or [None])[0],
            "market_cap": market_cap,
            "price": current_price,
            "volume_24h": volume_24h,
            "circulating_supply": market_data.get("circulating_supply"),
            "total_supply": market_data.get("total_supply"),
        },
        "market_data": {
            "price": current_price,
            "market_cap": market_cap,
            "volume_24h": volume_24h,
            "price_change_24h": change_24h,
            "price_change_7d": change_7d,
        },
    }

