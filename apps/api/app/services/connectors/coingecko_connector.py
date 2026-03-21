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
        "market_cap_rank": raw.get("market_cap_rank"),
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
    Extracts description, links (website, whitepaper, explorer), and market data.
    """
    market_data = raw.get("market_data") or {}

    current_price = (market_data.get("current_price") or {}).get(vs_currency)
    market_cap = (market_data.get("market_cap") or {}).get(vs_currency)
    volume_24h = (market_data.get("total_volume") or {}).get(vs_currency)

    change_24h = market_data.get("price_change_percentage_24h")
    change_7d = market_data.get("price_change_percentage_7d")

    links = raw.get("links") or {}
    homepage = (links.get("homepage") or [None])[0]
    wp = links.get("whitepaper")
    whitepaper = wp if isinstance(wp, str) else (wp.get("link") if isinstance(wp, dict) else None)
    blockchain_sites = links.get("blockchain_site") or []
    explorer = (blockchain_sites[0] or None) if blockchain_sites else None
    chat_url = links.get("chat_url") or []
    discord_url = (chat_url[0] or None) if chat_url else None

    return {
        "coin": {
            "external_id": raw.get("id"),
            "name": raw.get("name"),
            "symbol": (raw.get("symbol") or "").upper(),
            "slug": raw.get("id"),
            "market_cap_rank": raw.get("market_cap_rank") or market_data.get("market_cap_rank"),
            "description": (raw.get("description") or {}).get("en") or None,
            "logo_url": (raw.get("image") or {}).get("large"),
            "website": homepage,
            "whitepaper_url": whitepaper if isinstance(whitepaper, str) else None,
            "explorer_url": explorer,
            "twitter": links.get("twitter_screen_name"),
            "discord": discord_url,
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


def fetch_market_chart(coin_id: str, days: int = 7, vs_currency: str = "usd") -> Dict[str, Any]:
    """
    Fetch historical price chart data from CoinGecko's /coins/{id}/market_chart.
    Returns { prices: [[timestamp_ms, price], ...], market_caps, total_volumes }.
    """
    data = _get(
        f"/coins/{coin_id}/market_chart",
        params={"vs_currency": vs_currency, "days": str(days)},
    )
    return data


def fetch_trending_coins() -> List[Dict[str, Any]]:
    """
    Fetch trending coins from CoinGecko's /search/trending endpoint.

    Maps CoinGecko's schema into a simplified shape suitable for the
    /api/v1/market/trending endpoint:

    {
      name,
      symbol,
      rank,
      price,   # CoinGecko's price_btc field (denominated in BTC)
      image,
      coingecko_id,
      score
    }
    """
    data = _get("/search/trending")
    coins = data.get("coins") or []
    out: List[Dict[str, Any]] = []
    for idx, entry in enumerate(coins):
        item = entry.get("item") or {}
        name = item.get("name")
        symbol = item.get("symbol")
        if not name or not symbol:
            continue
        out.append(
            {
                "name": name,
                "symbol": symbol.upper(),
                "rank": item.get("market_cap_rank") or (idx + 1),
                "price": item.get("price_btc"),  # BTC-denominated price
                "image": item.get("large") or item.get("small") or item.get("thumb"),
                "coingecko_id": item.get("id"),
                "score": item.get("score"),
            }
        )
    return out

