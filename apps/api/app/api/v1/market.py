from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Coin, MarketData
from app.services.connectors.market_cache import market_cache_get, market_cache_set
from app.services.connectors.coingecko_connector import (
    fetch_all_coins,
    fetch_coins_by_category,
    fetch_coins_categories,
    fetch_global_market,
    fetch_trending_coins,
)


router = APIRouter(prefix="/api/v1/market", tags=["market"])

_CATEGORIES_CACHE_TTL = 300  # 5 minutes


def _coins_cache_ttl() -> int:
    try:
        return max(10, min(60, int(os.getenv("MARKET_COINS_CACHE_TTL", "25"))))
    except ValueError:
        return 25


@router.get("/summary")
def get_market_summary(
    db: Session = Depends(get_db),
    top: int = Query(
        30,
        ge=0,
        le=100,
        description="Top N coins (market cap desc); 0 = global only",
    ),
) -> Dict[str, Any]:
    """
    Single call for homepage: global totals from CoinGecko /global + optional top slice
    (same shape as GET /market/coins). Do not sum top-N for total cap — use global.*
    """
    cache_key = {"top": top}
    cached = market_cache_get("summary", 120, **cache_key)
    if cached is not None:
        return cached

    g: Dict[str, Any] = {}
    try:
        g = fetch_global_market()
    except Exception:
        g = {}

    top_rows: List[Dict[str, Any]] = []
    if top > 0:
        try:
            items = fetch_all_coins(vs_currency="usd", per_page=top, page=1)
            top_rows = [_serialize_market_item(item, light=False) for item in items]
        except Exception:
            top_rows = _load_market_fallback_from_db(db, limit=top, page=1, light=False)

    payload: Dict[str, Any] = {
        "schema_version": 1,
        "as_of": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "coingecko",
        "global": {
            "total_market_cap_usd": g.get("total_market_cap_usd"),
            "total_volume_usd": g.get("total_volume_usd"),
            "btc_dominance_pct": g.get("btc_dominance_pct"),
            "eth_dominance_pct": g.get("eth_dominance_pct"),
        },
        "top": top_rows,
    }
    market_cache_set("summary", 120, payload, **cache_key)
    return payload

# Fallback for common CoinGecko slugs when not in DB or when symbol is slug-like
SLUG_TO_SYMBOL: Dict[str, str] = {
    "bitcoin": "BTC", "ethereum": "ETH", "tether": "USDT", "binancecoin": "BNB",
    "usd-coin": "USDC", "ripple": "XRP", "solana": "SOL", "staked-ether": "STETH",
    "cardano": "ADA", "dogecoin": "DOGE", "avalanche-2": "AVAX", "chainlink": "LINK",
    "tron": "TRX", "polkadot": "DOT", "bitcoin-cash": "BCH", "uniswap": "UNI",
    "matic-network": "MATIC", "shiba-inu": "SHIB", "litecoin": "LTC", "dai": "DAI",
    "monero": "XMR", "usds": "USDS", "wrapped-bitcoin": "WBTC", "first-digital-usd": "FDUSD",
    "aave-v3-weth": "WETH", "aave-weth": "WETH", "leo-token": "LEO",
    "mantle": "MNT", "the-open-network": "TON", "tokenize-xchange": "TKX",
    "hyperliquid": "HYPE", "usd1": "USD1", "euro-coin": "EURC",
    "curve-dao-token": "CRV", "gnosis": "GNO", "optimism": "OP", "arbitrum": "ARB",
    "echelon-prime": "PRIME", "great-ape": "GREAT", "sun-token": "SUN",
    "fetch-ai": "FET", "bittensor": "TAO", "singularitynet": "AGIX", "render-token": "RENDER",
    "internet-protocol": "IP", "io-net": "IO", "2-2": "2Z", "iota": "IOTA",
    "true-usd": "TUSD", "paxos-standard": "PAX", "gemini-dollar": "GUSD",
}


def _normalize_symbol(slug: str, raw_symbol: str) -> str:
    """Return display symbol; use SLUG_TO_SYMBOL when symbol is empty or looks like a slug."""
    s = (raw_symbol or "").strip().upper()
    if s and len(s) <= 6 and "-" not in s:
        return s
    return SLUG_TO_SYMBOL.get(slug.lower(), s or slug.upper() if len(slug) <= 5 else slug.upper())


def _serialize_market_item(item: Dict[str, Any], light: bool = False) -> Dict[str, Any]:
    base = {
        "name": item.get("name"),
        "symbol": item.get("symbol"),
        "price": item.get("price"),
        "change_24h": item.get("price_change_24h"),
        "volume": item.get("volume_24h") if "volume_24h" in (item or {}) else item.get("volume"),
        "slug": item.get("slug"),
    }
    if light:
        return base  # Minimal: name, price, 24h%, volume, slug
    base["change_7d"] = item.get("price_change_7d")
    base["market_cap"] = item.get("market_cap")
    base["logo_url"] = item.get("logo_url") or item.get("image")
    return base


def _load_market_fallback_from_db(
    db: Session, *, limit: int, page: int = 1, light: bool = False
) -> List[Dict[str, Any]]:
    """
    Return last-known-good market snapshot from DB when CoinGecko is unavailable.
    Uses batched MarketData query to avoid N+1.
    Supports pagination via offset for pages beyond CoinGecko limit.
    """
    offset = (page - 1) * limit
    coins = (
        db.query(Coin)
        .order_by(Coin.market_cap.desc().nullslast())
        .offset(offset)
        .limit(limit)
        .all()
    )
    if not coins:
        return []
    coin_ids = [c.id for c in coins]
    # Subquery: latest timestamp per coin
    subq = (
        db.query(MarketData.coin_id, func.max(MarketData.timestamp).label("max_ts"))
        .filter(MarketData.coin_id.in_(coin_ids))
        .group_by(MarketData.coin_id)
        .subquery()
    )
    latest_md = (
        db.query(MarketData)
        .join(subq, (MarketData.coin_id == subq.c.coin_id) & (MarketData.timestamp == subq.c.max_ts))
        .filter(MarketData.coin_id.in_(coin_ids))
        .all()
    )
    md_by_coin: Dict[int, Any] = {m.coin_id: m for m in latest_md}

    rows: List[Dict[str, Any]] = []
    for coin in coins:
        m = md_by_coin.get(coin.id)
        base = {
            "name": coin.name,
            "symbol": coin.symbol,
            "price": m.price if m and m.price is not None else coin.price,
            "change_24h": m.price_change_24h if m else None,
            "volume": m.volume_24h if m and m.volume_24h is not None else coin.volume_24h,
            "slug": coin.slug,
        }
        if light:
            rows.append(base)
        else:
            rows.append({
                **base,
                "change_7d": m.price_change_7d if m else None,
                "market_cap": m.market_cap if m and m.market_cap is not None else coin.market_cap,
                "logo_url": coin.logo_url,
            })
    return rows


# CoinGecko free tier returns at most ~500 coins (~5 pages at 100/page).
# Beyond this, use DB fallback which supports full pagination.
_COINGECKO_MAX_PAGE = 5


@router.get("/coins", response_model=List[Dict[str, Any]])
def get_market_coins(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    page: int = Query(1, ge=1, le=100),
    light: bool = Query(False, description="Reduce payload to name, price, change_24h, volume, slug"),
) -> List[Dict[str, Any]]:
    """
    Return live market coins from CoinGecko /coins/markets.
    For page > 5 (CoinGecko limit), use DB directly.

    Request params used:
    - vs_currency=usd
    - order=market_cap_desc
    - per_page=<limit>
    - page=<page>
    - price_change_percentage=24h,7d
    """
    cache_key_params = {"limit": limit, "page": page, "light": light}
    _ttl = _coins_cache_ttl()
    cached = market_cache_get("coins", _ttl, **cache_key_params)
    if cached is not None:
        return cached

    # For high pages, CoinGecko returns empty; use DB directly.
    if page > _COINGECKO_MAX_PAGE:
        fallback_rows = _load_market_fallback_from_db(db, limit=limit, page=page, light=light)
        if fallback_rows:
            market_cache_set("coins", _ttl, fallback_rows, **cache_key_params)
            return fallback_rows

    try:
        items = fetch_all_coins(vs_currency="usd", per_page=limit, page=page)
        if items:  # Only cache/return if we got data
            result = [_serialize_market_item(item, light=light) for item in items]
            market_cache_set("coins", _ttl, result, **cache_key_params)
            return result
    except Exception:
        pass

    # Fallback to DB when CoinGecko fails or returns empty
    fallback_rows = _load_market_fallback_from_db(db, limit=limit, page=page, light=light)
    if fallback_rows:
        market_cache_set("coins", _ttl, fallback_rows, **cache_key_params)
        return fallback_rows
    raise HTTPException(
        status_code=502,
        detail="Failed to load CoinGecko market data and no fallback snapshot available",
    )


def _load_categories_fallback_from_db(db: Session) -> List[Dict[str, Any]]:
    """
    Aggregate categories from Coin table when CoinGecko is unavailable.
    Groups by category, sums market_cap and volume_24h.
    Adds top_3_coins_id from top coins per category and market_cap_change_24h from MarketData.
    """
    from sqlalchemy import func

    rows = (
        db.query(
            Coin.category,
            func.coalesce(func.sum(Coin.market_cap), 0).label("market_cap"),
            func.coalesce(func.sum(Coin.volume_24h), 0).label("volume_24h"),
        )
        .filter(Coin.category.isnot(None), Coin.category != "")
        .group_by(Coin.category)
        .order_by(func.coalesce(func.sum(Coin.market_cap), 0).desc())
        .all()
    )

    def slug_from_name(name: str) -> str:
        return (name or "").lower().replace(" ", "-").replace("_", "-")

    # Get top 5 coins (slug, symbol) per category
    top_coins_by_cat: Dict[str, List[Dict[str, str]]] = {}
    coins_ordered = (
        db.query(Coin.category, Coin.slug, Coin.symbol, Coin.market_cap)
        .filter(Coin.category.isnot(None), Coin.category != "")
        .order_by(Coin.category, Coin.market_cap.desc().nullslast())
        .all()
    )
    for cat, slug, symbol, _ in coins_ordered:
        if cat and slug:
            if cat not in top_coins_by_cat:
                top_coins_by_cat[cat] = []
            if len(top_coins_by_cat[cat]) < 5:
                top_coins_by_cat[cat].append({"slug": slug, "symbol": _normalize_symbol(slug, symbol)})

    # Get market_cap_change_24h per category (weighted avg from top coins' MarketData)
    change_by_cat: Dict[str, float] = {}
    for cat in top_coins_by_cat:
        coins_list = top_coins_by_cat[cat]
        if not coins_list:
            continue
        slugs = [c["slug"] for c in coins_list]
        coins_in_cat = db.query(Coin).filter(Coin.slug.in_(slugs)).all()
        if not coins_in_cat:
            continue
        total_mcap = 0.0
        weighted_sum = 0.0
        for coin in coins_in_cat:
            latest = (
                db.query(MarketData)
                .filter(MarketData.coin_id == coin.id)
                .order_by(MarketData.timestamp.desc())
                .first()
            )
            if latest and latest.price_change_24h is not None and coin.market_cap:
                mcap = float(coin.market_cap)
                total_mcap += mcap
                weighted_sum += mcap * latest.price_change_24h
        if total_mcap > 0:
            change_by_cat[cat] = weighted_sum / total_mcap  # 0 if no MarketData

    return [
        {
            "id": slug_from_name(cat),
            "name": cat,
            "market_cap": float(mcap or 0),
            "market_cap_change_24h": change_by_cat.get(cat),
            "volume_24h": float(vol or 0),
            "top_coins": top_coins_by_cat.get(cat, []),
            "content": None,
        }
        for cat, mcap, vol in rows
    ]


@router.get("/categories")
def get_market_categories(
    db: Session = Depends(get_db),
    order: str = Query("market_cap_desc", description="Sort: market_cap_desc, market_cap_asc, name_asc, name_desc"),
    limit: int = Query(100, ge=1, le=500),
    page: int = Query(1, ge=1, le=100),
) -> Dict[str, Any]:
    """
    Return coin categories with market cap, 24h volume, and top 5 coins per category.
    Primary: CoinGecko (hundreds of categories). Fallback: DB when CoinGecko fails.
    Top 5 coins from CoinGecko /coins/markets?category=id (sequential, rate-limited).
    Response cached 5 min to avoid rate limits.
    """
    cached = market_cache_get("categories", _CATEGORIES_CACHE_TTL, order=order, limit=limit, page=page)
    if cached is not None:
        return cached
    for attempt in range(3):
        try:
            if attempt > 0:
                time.sleep(5)  # Longer backoff before retry
            items = fetch_coins_categories(order=order)
            if items:
                total = len(items)
                offset = (page - 1) * limit
                page_items = items[offset : offset + limit]
                # Pre-load slug->symbol for top_3_coins_id (fallback when API returns fewer than 5)
                all_cg_slugs = list(dict.fromkeys(
                    s for cat in page_items for s in (cat.get("top_3_coins_id") or [])
                    if s
                ))
                slug_to_symbol: Dict[str, str] = {}
                if all_cg_slugs:
                    try:
                        rows = db.query(Coin.slug, Coin.symbol).filter(Coin.slug.in_(all_cg_slugs)).all()
                        slug_to_symbol = {s: _normalize_symbol(s, sym) for s, sym in rows}
                    except Exception:
                        pass
                for s in all_cg_slugs:
                    if s not in slug_to_symbol:
                        slug_to_symbol[s] = _normalize_symbol(s, None)
                # Fetch top 5 coins per category from CoinGecko - limit to first 25 to avoid rate limits
                # Rest use top_3_coins_id from categories + DB supplement
                MAX_CG_FETCH = 25
                cat_id_to_coins: Dict[str, List[Dict[str, str]]] = {}
                for i, cat in enumerate(page_items):
                    cid = cat.get("id")
                    if not cid:
                        continue
                    if i > 0:
                        time.sleep(0.35)
                    if i >= MAX_CG_FETCH:
                        break  # Use top_3_coins_id + DB for the rest
                    coins_data = fetch_coins_by_category(cid, "usd", 5)
                    if coins_data:
                        cat_id_to_coins[cid] = [
                            {"slug": c["id"], "symbol": _normalize_symbol(c["id"], c.get("symbol"))}
                            for c in coins_data[:5]
                        ]
                # Build top_coins: API result first, then top_3_coins_id, then DB supplement
                for cat in page_items:
                    cid = cat.get("id")
                    cat_name = (cat.get("name") or "").strip()
                    api_coins = cat_id_to_coins.get(cid, []) if cid else []
                    seen = {c["slug"] for c in api_coins}
                    merged = list(api_coins)
                    for slug in (cat.get("top_3_coins_id") or [])[:3]:
                        if slug not in seen and len(merged) < 5:
                            merged.append({"slug": slug, "symbol": slug_to_symbol.get(slug, _normalize_symbol(slug, None))})
                            seen.add(slug)
                    if len(merged) < 5 and (cat_name or cid):
                        q = db.query(Coin.slug, Coin.symbol).filter(Coin.market_cap.isnot(None))
                        if seen:
                            q = q.filter(Coin.slug.notin_(seen))
                        or_terms = []
                        if cat_name:
                            or_terms.append(Coin.category.ilike(f"%{cat_name}%"))
                        if cid:
                            or_terms.append(Coin.category.ilike(f"%{cid}%"))
                        if "stable" in (cid or "").lower() or "stable" in (cat_name or "").lower():
                            or_terms.append(Coin.category.ilike("%stablecoin%"))
                        if "dex" in (cid or "").lower() or "exchange" in (cid or "").lower():
                            or_terms.append(Coin.category.ilike("%dex%"))
                            or_terms.append(Coin.category.ilike("%exchange%"))
                        if or_terms:
                            q = q.filter(or_(*or_terms))
                        for slug, sym in q.order_by(Coin.market_cap.desc().nullslast()).limit(5 - len(merged)).all():
                            merged.append({"slug": slug, "symbol": _normalize_symbol(slug, sym)})
                            seen.add(slug)
                    cat["top_coins"] = merged[:5]
                result = {"items": page_items, "total": total}
                market_cache_set("categories", _CATEGORIES_CACHE_TTL, result, order=order, limit=limit, page=page)
                return result
        except Exception as exc:
            backoff = 10 if getattr(exc, "response", None) and getattr(exc.response, "status_code", None) == 429 else 2
            if attempt < 2:
                time.sleep(backoff)
            pass
    # Fallback: DB aggregation when CoinGecko fails
    try:
        all_rows = _load_categories_fallback_from_db(db)
        total = len(all_rows)
        offset = (page - 1) * limit
        return {"items": all_rows[offset : offset + limit], "total": total}
    except Exception:
        return {"items": [], "total": 0}


@router.get("/trending", response_model=List[Dict[str, Any]])
def get_trending_market_coins(
    db: Session = Depends(get_db),  # noqa: ARG001 (reserved for future DB-backed enrichment)
    limit: int = Query(20, ge=1, le=100),
) -> List[Dict[str, Any]]:
    """
    Return trending coins from CoinGecko's /search/trending endpoint.

    This is a thin proxy over CoinGecko with a stable, frontend-friendly shape:

    - name
    - symbol
    - rank
    - price (CoinGecko price_btc; BTC-denominated)
    - image
    - coingecko_id
    - score
    """
    cached = market_cache_get("trending", 300, limit=limit)
    if cached is not None:
        return cached
    try:
        items = fetch_trending_coins()
        result = items[:limit]
        market_cache_set("trending", 300, result, limit=limit)
        return result
    except Exception as exc:  # pragma: no cover - network errors
        raise HTTPException(status_code=502, detail="Failed to load CoinGecko trending data") from exc

