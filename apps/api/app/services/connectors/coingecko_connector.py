from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests

from app.services.connectors.chart_cache import (
    chart_cache_get,
    chart_cache_get_stale,
    chart_cache_set,
    get_chart_ttl,
)

logger = logging.getLogger(__name__)

COINGECKO_API_BASE = os.getenv("COINGECKO_API_BASE", "https://api.coingecko.com/api/v3")


def _get(path: str, params: Optional[Dict[str, Any]] = None) -> Any:
    url = f"{COINGECKO_API_BASE}{path}"
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


def fetch_coin_markets_row_by_id(coin_gecko_id: str) -> Optional[Dict[str, Any]]:
    """
    One-row snapshot from /coins/markets?ids=... — fast path for live price,
    24h/7d %, market cap, volume (avoids scanning paginated markets).
    coin_gecko_id: CoinGecko coin id (e.g. ripple, bitcoin).
    """
    cid = (coin_gecko_id or "").lower().strip()
    if not cid:
        return None
    url = f"{COINGECKO_API_BASE}/coins/markets"
    try:
        resp = requests.get(
            url,
            params={
                "vs_currency": "usd",
                "ids": cid,
                "order": "market_cap_desc",
                "per_page": 1,
                "page": 1,
                "sparkline": "false",
            },
            timeout=8,
        )
        if resp.status_code != 200:
            logger.debug("markets by id non-200 %s: %s", cid, resp.status_code)
            return None
        rows = resp.json()
        if isinstance(rows, list) and rows and isinstance(rows[0], dict):
            return rows[0]
    except Exception as e:
        logger.debug("fetch_coin_markets_row_by_id %s: %s", cid, e)
    return None


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


def search_coins(query: str) -> List[Dict[str, Any]]:
    """
    Search coins via CoinGecko /search endpoint.
    Returns [{id, name, symbol, ...}, ...]. Used to resolve slugs when direct fetch fails.
    """
    data = _get("/search", params={"query": query})
    return data.get("coins") or []


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


def _parse_coingecko_datetime(raw: Any) -> Optional[datetime]:
    if not raw or not isinstance(raw, str):
        return None
    try:
        s = raw.replace("Z", "+00:00") if isinstance(raw, str) else str(raw)
        return datetime.fromisoformat(s)
    except (TypeError, ValueError):
        return None


def market_extras_dict_from_coingecko_coin(
    raw: Dict[str, Any], vs_currency: str = "usd"
) -> Optional[Dict[str, Any]]:
    """
    ATH/ATL, supply, FDV, contract platforms from raw /coins/{id} JSON.
    Returns a dict suitable for CoinMarketExtras.model_validate, or None if empty.
    """
    md = raw.get("market_data") or {}
    vs = (vs_currency or "usd").lower()

    def _f_nested(obj: Any, *keys: str) -> Optional[float]:
        cur: Any = obj
        for k in keys:
            if not isinstance(cur, dict):
                return None
            cur = cur.get(k)
        if cur is None:
            return None
        try:
            v = float(cur)
            return v if v == v else None  # NaN -> None
        except (TypeError, ValueError):
            return None

    ath_usd = _f_nested(md, "ath", vs)
    atl_usd = _f_nested(md, "atl", vs)
    ath_chg = _f_nested(md, "ath_change_percentage", vs)
    atl_chg = _f_nested(md, "atl_change_percentage", vs)
    ath_date_raw = (md.get("ath_date") or {}).get(vs) if isinstance(md.get("ath_date"), dict) else None
    atl_date_raw = (md.get("atl_date") or {}).get(vs) if isinstance(md.get("atl_date"), dict) else None
    ath_date = _parse_coingecko_datetime(ath_date_raw)
    atl_date = _parse_coingecko_datetime(atl_date_raw)

    max_sup = md.get("max_supply")
    max_supply: Optional[float] = None
    if max_sup is not None:
        try:
            max_supply = float(max_sup)
            if max_supply != max_supply:
                max_supply = None
        except (TypeError, ValueError):
            max_supply = None

    fdv = _f_nested(md, "fully_diluted_valuation", vs)

    platforms_out: List[Dict[str, str]] = []
    pl = raw.get("platforms") or {}
    if isinstance(pl, dict):
        for platform_id, addr in pl.items():
            if not platform_id or addr is None:
                continue
            saddr = str(addr).strip()
            if saddr:
                platforms_out.append({"platform_id": str(platform_id), "contract_address": saddr})

    if not any(
        x is not None
        for x in (
            ath_usd,
            atl_usd,
            ath_chg,
            atl_chg,
            max_supply,
            fdv,
        )
    ) and not platforms_out:
        return None

    out: Dict[str, Any] = {
        "ath_usd": ath_usd,
        "ath_change_pct_vs_current": ath_chg,
        "ath_date": ath_date,
        "atl_usd": atl_usd,
        "atl_change_pct_vs_current": atl_chg,
        "atl_date": atl_date,
        "max_supply": max_supply,
        "fully_diluted_valuation_usd": fdv,
        "platforms": platforms_out,
    }
    return out


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
    tg_id = links.get("telegram_channel_identifier")
    telegram_url = f"https://t.me/{tg_id}" if tg_id and isinstance(tg_id, str) else None

    cats_raw = [c for c in (raw.get("categories") or []) if c]
    try:
        from app.services.category_slug_resolver import ensure_slug, resolve_primary_category

        _disp, _slug = resolve_primary_category(cats_raw)
        primary_cat = _disp or ((cats_raw[0] if cats_raw else None))
        cat_slug = ensure_slug(_slug) if cats_raw else None
    except Exception:
        primary_cat = (raw.get("categories") or [None])[0]
        cat_slug = None

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
            "telegram": telegram_url,
            "chain": None,
            "category": primary_cat,
            "category_slug": cat_slug,
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
        "market_extras": market_extras_dict_from_coingecko_coin(raw, vs_currency=vs_currency),
    }


def fetch_market_chart_for_ohlc(
    coin_id: str,
    timeframe: str,
    limit: int = 200,
    vs_currency: str = "usd",
) -> tuple[list[list], list[list]] | None:
    """
    Fetch price + volume from market_chart for OHLC synthesis.
    Returns (prices, volumes) or None. prices/volumes: [[timestamp_ms, value], ...]

    Use enough `days` so CoinGecko returns hourly (≤90d) or daily points to
    satisfy `limit` for 1h/4h/1d chart packs.
    """
    tf = (timeframe or "1h").lower()
    # CoinGecko: ~5m for 1d; hourly for 2–90d; daily beyond (see CG docs).
    tf_days: dict[str, int] = {
        "1m": 1,
        "5m": 2,
        "15m": 2,
        "1h": 90,
        "4h": 90,
        "1d": 365,
        "1w": 365,
    }
    days = int(tf_days.get(tf, 90))
    try:
        data = _get(
            f"/coins/{coin_id}/market_chart",
            params={"vs_currency": vs_currency, "days": days},
        )
        prices = data.get("prices") or []
        vols = data.get("total_volumes") or []
        if not prices:
            return None
        if len(prices) > limit:
            prices = prices[-limit:]
            vols = (vols[-limit:] if len(vols) > limit else vols) if vols else vols
        return (prices, vols)
    except Exception as e:
        logger.debug("CoinGecko market_chart for OHLC failed: %s", e)
        return None


def fetch_market_chart(
    coin_id: str,
    days: int | str = 7,
    vs_currency: str = "usd",
    symbol_override: str | None = None,
) -> Dict[str, Any]:
    """
    Fetch historical price chart. CoinGecko first, Binance.US fallback on 429/no data.
    Returns { prices: [[timestamp_ms, price], ...], market_caps, total_volumes }.
    """
    days_param = "max" if days == "max" or (isinstance(days, int) and days > 365) else str(days)
    days_int = 365 if days_param == "max" else int(days_param)
    cache_key = f"{coin_id}:{days_param}:{vs_currency}"
    ttl = get_chart_ttl(days_param)
    cached = chart_cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        data = _get(
            f"/coins/{coin_id}/market_chart",
            params={"vs_currency": vs_currency, "days": days_param},
        )
        chart_cache_set(cache_key, data, ttl)
        return data
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 429:
            stale = chart_cache_get_stale(cache_key)
            if stale:
                logger.warning("CoinGecko 429, serving stale chart for %s", cache_key)
                return stale
            bn_symbol = symbol_override or (
                __import__(
                    "app.services.connectors.binance_us_connector",
                    fromlist=["slug_to_binance_symbol"],
                ).slug_to_binance_symbol(coin_id)
            )
            if bn_symbol:
                from app.services.connectors.binance_us_connector import fetch_klines_chart

                prices = fetch_klines_chart(bn_symbol, days=days_int)
                if prices:
                    data = {"prices": prices, "market_caps": [], "total_volumes": []}
                    chart_cache_set(cache_key, data, ttl)
                    return data
        raise


def fetch_coins_by_category(
    category_id: str,
    vs_currency: str = "usd",
    per_page: int = 5,
) -> List[Dict[str, Any]]:
    """Fetch top coins for a category from CoinGecko /coins/markets (minimal shape for top_coins)."""
    try:
        data = _get(
            "/coins/markets",
            params={
                "vs_currency": vs_currency,
                "category": category_id,
                "order": "market_cap_desc",
                "per_page": per_page,
                "page": 1,
                "sparkline": "false",
            },
        )
        return [
            {"id": item.get("id"), "symbol": (item.get("symbol") or "").upper()}
            for item in (data or [])
            if item.get("id")
        ]
    except Exception:
        return []


def fetch_coins_markets_by_category(
    category_id: str,
    vs_currency: str = "usd",
    per_page: int = 100,
    page: int = 1,
) -> List[Dict[str, Any]]:
    """
    Fetch full market data for coins in a category from CoinGecko /coins/markets.
    Returns same shape as fetch_all_coins (normalized) for discover/category pages.
    """
    try:
        data = _get(
            "/coins/markets",
            params={
                "vs_currency": vs_currency,
                "category": category_id,
                "order": "market_cap_desc",
                "per_page": per_page,
                "page": page,
                "sparkline": "false",
                "price_change_percentage": "24h,7d",
            },
        )
        return [normalize_market_coin(item) for item in (data or [])]
    except Exception:
        return []


def fetch_coins_categories(
    order: str = "market_cap_desc",
) -> List[Dict[str, Any]]:
    """
    Fetch coin categories with market data from CoinGecko /coins/categories.
    Returns: id, name, market_cap, market_cap_change_24h, volume_24h, top_3_coins, content.
    """
    data = _get(
        "/coins/categories",
        params={"order": order},
    )
    return data if isinstance(data, list) else []


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

