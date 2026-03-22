from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Coin, CoinNarrative, MarketData, Narrative, NewsArticle
from app.schemas.coin_api import (
    CoinDetailResponse,
    CoinInfo,
    CoinListItem,
    MarketDataPoint,
    NarrativeRead,
    NewsArticleRead,
)
from app.services.news.cache import TTLCache


router = APIRouter(prefix="/api/v1/coins", tags=["coins"])


COINS_PER_PAGE = 100
TOTAL_COINS_PAGINATED = 2000
TOTAL_PAGES = TOTAL_COINS_PAGINATED // COINS_PER_PAGE  # 20

# Cache coins list to avoid exceeding CoinGecko rate limits (~30/min free tier).
# 90s TTL keeps data fresh while reducing redundant API calls.
_coins_list_cache = TTLCache()
COINS_LIST_CACHE_TTL = 90

# Minimum seconds between CoinGecko requests to stay under ~30/min.
COINGECKO_MIN_INTERVAL = 2.5
_last_coingecko_call: float = 0


def _coingecko_throttle() -> None:
    """Ensure we don't exceed CoinGecko free tier (~30 req/min)."""
    global _last_coingecko_call
    now = time.time()
    elapsed = now - _last_coingecko_call
    if elapsed < COINGECKO_MIN_INTERVAL and _last_coingecko_call > 0:
        time.sleep(COINGECKO_MIN_INTERVAL - elapsed)
    _last_coingecko_call = time.time()


def _fetch_coingecko_price_changes(limit: int, max_pages: int = 2) -> dict[str, dict]:
    """
    Fetch price_change_24h and price_change_7d from CoinGecko /coins/markets.
    Returns {slug: {price_change_24h, price_change_7d}}.
    Capped at max_pages to avoid rate limits (free tier ~30 req/min).
    """
    from app.services.connectors.coingecko_connector import fetch_all_coins

    out: dict[str, dict] = {}
    try:
        pages_needed = min(max_pages, max(1, (limit + 249) // 250))
        for page in range(1, pages_needed + 1):
            _coingecko_throttle()
            items = fetch_all_coins(vs_currency="usd", per_page=250, page=page)
            for item in items:
                slug = item.get("slug")
                if slug and slug not in out:
                    out[slug] = {
                        "price_change_24h": item.get("price_change_24h"),
                        "price_change_7d": item.get("price_change_7d"),
                    }
    except Exception:
        pass
    return out


def _fetch_coins_from_coingecko(page: int, limit: int) -> List[CoinListItem]:
    """
    Fetch a page of coins from CoinGecko.
    Uses per_page=100 for API calls; slices to requested limit.
    Throttled to respect free tier rate limits.
    """
    from app.services.connectors.coingecko_connector import fetch_all_coins

    start_idx = (page - 1) * limit
    cg_page = (start_idx // COINS_PER_PAGE) + 1
    offset_in_page = start_idx % COINS_PER_PAGE

    _coingecko_throttle()
    items = fetch_all_coins(vs_currency="usd", per_page=COINS_PER_PAGE, page=cg_page)
    items = items[offset_in_page : offset_in_page + limit]

    result: List[CoinListItem] = []
    for i, cg in enumerate(items):
        rank = (page - 1) * limit + i + 1
        coin_id = cg.get("market_cap_rank") or rank
        coin_info = CoinInfo(
            id=coin_id,
            name=cg.get("name") or "",
            symbol=(cg.get("symbol") or "").upper(),
            slug=cg.get("slug") or "",
            description=None,
            logo_url=cg.get("logo_url"),
            website=None,
            whitepaper_url=None,
            explorer_url=None,
            twitter=None,
            discord=None,
            chain=None,
            category=None,
            market_cap_rank=cg.get("market_cap_rank"),
            market_cap=cg.get("market_cap"),
            price=cg.get("price"),
            volume_24h=cg.get("volume_24h"),
            circulating_supply=cg.get("circulating_supply"),
            total_supply=cg.get("total_supply"),
        )
        md_point = MarketDataPoint(
            timestamp=datetime.now(timezone.utc),
            price=cg.get("price") or 0.0,
            market_cap=cg.get("market_cap"),
            volume_24h=cg.get("volume_24h"),
            price_change_24h=cg.get("price_change_24h"),
            price_change_7d=cg.get("price_change_7d"),
        )
        result.append(CoinListItem(coin=coin_info, latest_market_data=md_point))
    return result


def _fetch_coins_from_coinmarketcap(page: int, limit: int) -> List[CoinListItem]:
    """
    Fetch a page of coins from CoinMarketCap listings/latest.
    Used as fallback when CoinGecko returns empty (pages 6+ on free tier).
    Requires CMC_API_KEY env var.
    """
    from app.services.connectors.coinmarketcap_connector import fetch_listings_latest

    start = (page - 1) * limit + 1
    items = fetch_listings_latest(start=start, limit=limit)

    result: List[CoinListItem] = []
    for i, cmc in enumerate(items):
        rank = (page - 1) * limit + i + 1
        coin_id = cmc.get("market_cap_rank") or rank
        coin_info = CoinInfo(
            id=coin_id,
            name=cmc.get("name") or "",
            symbol=(cmc.get("symbol") or "").upper(),
            slug=cmc.get("slug") or "",
            description=None,
            logo_url=cmc.get("logo_url"),
            website=None,
            whitepaper_url=None,
            explorer_url=None,
            twitter=None,
            discord=None,
            chain=None,
            category=None,
            market_cap_rank=cmc.get("market_cap_rank"),
            market_cap=cmc.get("market_cap"),
            price=cmc.get("price"),
            volume_24h=cmc.get("volume_24h"),
            circulating_supply=cmc.get("circulating_supply"),
            total_supply=cmc.get("total_supply"),
        )
        md_point = MarketDataPoint(
            timestamp=datetime.now(timezone.utc),
            price=cmc.get("price") or 0.0,
            market_cap=cmc.get("market_cap"),
            volume_24h=cmc.get("volume_24h"),
            price_change_24h=cmc.get("price_change_24h"),
            price_change_7d=cmc.get("price_change_7d"),
        )
        result.append(CoinListItem(coin=coin_info, latest_market_data=md_point))
    return result


# Slug -> alternates for category filter; helps match "layer-1" to "Layer 1 (L1)" etc.
def _norm_slug(s: str) -> str:
    return (s or "").lower().replace(" ", "-").replace("(", "").replace(")", "")


CATEGORY_SLUG_ALTERNATES: dict[str, list[str]] = {
    "layer-1": ["Layer 1", "Layer 1 (L1)", "L1"],
    "layer-2": ["Layer 2", "Layer 2 (L2)", "L2"],
    "layer2-tokens": ["Layer 2", "Layer 2 (L2)", "L2"],
    "proof-of-work": ["Proof of Work", "Proof of Work (PoW)", "PoW"],
    "proof-of-work-pow": ["Proof of Work", "Proof of Work (PoW)", "PoW"],
    "proof-of-stake": ["Proof of Stake", "Proof of Stake (PoS)", "PoS"],
    "proof-of-stake-pos": ["Proof of Stake", "Proof of Stake (PoS)", "PoS"],
    "smart-contract-platform": ["Smart Contract Platform"],
    "stablecoins": ["Stablecoins", "Stablecoin", "USD Stablecoin", "Fiat-backed Stablecoin"],
    "yield-bearing-stablecoins": ["Stablecoins", "Yield-bearing"],
    "defi": ["DeFi", "Decentralized Finance"],
    "decentralized-finance-defi": ["DeFi", "Decentralized Finance"],
    "dex": ["DEX", "Decentralized Exchange"],
    "decentralized-exchange-dex": ["DEX", "Decentralized Exchange"],
    "decentralized-exchange-(dex)": ["DEX", "Decentralized Exchange"],
    "artificial-intelligence": ["Artificial Intelligence", "AI"],
    "artificial-intelligence-ai": ["Artificial Intelligence", "AI"],
    "artificial-intelligence-(ai)": ["Artificial Intelligence", "AI"],
    "infrastructure": ["Infrastructure"],
    "depin": ["DePIN", "Decentralized Physical Infrastructure"],
    "depin-tokens": ["DePIN", "Decentralized Physical Infrastructure"],
    "solana-ecosystem": ["Solana Ecosystem", "Solana"],
    "ethereum-ecosystem": ["Ethereum Ecosystem", "Ethereum"],
    "gaming": ["Gaming", "GameFi"],
    "gaming-tokens": ["Gaming", "GameFi"],
    "meme": ["Meme", "Meme coins"],
    "meme-coins": ["Meme", "Meme coins"],
    "real-world-assets-rwa": ["Real World Assets", "RWA"],
    "liquid-staking-derivatives": ["Liquid Staking", "LSD"],
    "nft-tokens": ["NFT", "NFT tokens"],
    "tokenized-gold": ["Tokenized Gold", "Gold"],
    "bridges": ["Bridges", "Bridge"],
}


@router.get("", response_model=List[CoinListItem])
def list_coins(
    limit: int = Query(100, ge=1, le=500),
    page: int = Query(1, ge=1, le=500, description="Page for paginated list"),
    category: Optional[str] = Query(None, description="Filter by category (e.g. AI, DePIN, Gaming, Layer 2)"),
    category_slug: Optional[str] = Query(None, description="Category slug (e.g. layer-1) - uses alternates for matching"),
    db: Session = Depends(get_db),
) -> List[CoinListItem]:
    cat_filter = category
    if not cat_filter and category_slug:
        norm_slug = _norm_slug(category_slug)
        alternates = CATEGORY_SLUG_ALTERNATES.get(norm_slug) or CATEGORY_SLUG_ALTERNATES.get(
            category_slug.lower()
        )
        if alternates:
            cat_filter = alternates[0]
        else:
            raw = category_slug.replace("-", " ")
            for sep in ("(", ")"):
                raw = raw.replace(sep, " ")
            cat_filter = " ".join(raw.split()).strip() or category_slug.replace("-", " ").title()
    cache_key = f"coins:{page}:{limit}:{cat_filter or ''}:{category_slug or ''}"
    cached = _coins_list_cache.get(cache_key)
    if cached is not None:
        return cached

    # When category_slug provided: CoinGecko /coins/markets?category=id first (discover pages)
    if category_slug:
        try:
            from app.services.connectors.coingecko_connector import fetch_coins_markets_by_category

            cg_items = fetch_coins_markets_by_category(
                category_id=category_slug,
                vs_currency="usd",
                per_page=limit,
                page=page,
            )
            if cg_items:
                out: List[CoinListItem] = []
                for i, cg in enumerate(cg_items):
                    rank = (page - 1) * limit + i + 1
                    coin_id = cg.get("market_cap_rank") or rank
                    coin_info = CoinInfo(
                        id=coin_id,
                        name=cg.get("name") or "",
                        symbol=(cg.get("symbol") or "").upper(),
                        slug=cg.get("slug") or "",
                        description=None,
                        logo_url=cg.get("logo_url"),
                        website=None,
                        whitepaper_url=None,
                        explorer_url=None,
                        twitter=None,
                        discord=None,
                        chain=None,
                        category=None,
                        market_cap_rank=cg.get("market_cap_rank"),
                        market_cap=cg.get("market_cap"),
                        price=cg.get("price"),
                        volume_24h=cg.get("volume_24h"),
                        circulating_supply=cg.get("circulating_supply"),
                        total_supply=cg.get("total_supply"),
                    )
                    md_point = MarketDataPoint(
                        timestamp=datetime.now(timezone.utc),
                        price=cg.get("price") or 0.0,
                        market_cap=cg.get("market_cap"),
                        volume_24h=cg.get("volume_24h"),
                        price_change_24h=cg.get("price_change_24h"),
                        price_change_7d=cg.get("price_change_7d"),
                    )
                    out.append(CoinListItem(coin=coin_info, latest_market_data=md_point))
                _coins_list_cache.set(cache_key, out, COINS_LIST_CACHE_TTL)
                return out
        except Exception:
            pass

    # When no category filter: CoinGecko first, then CoinMarketCap (if configured), then DB
    # CoinGecko free API limits to ~500 coins; CMC fallback covers pages 6-20
    if cat_filter is None:
        try:
            cg_items = _fetch_coins_from_coingecko(page, limit)
            if cg_items:
                _coins_list_cache.set(cache_key, cg_items, COINS_LIST_CACHE_TTL)
                return cg_items
        except Exception:
            pass

        # Try CoinMarketCap fallback when CMC_API_KEY is set
        if os.getenv("CMC_API_KEY", "").strip():
            try:
                cmc_items = _fetch_coins_from_coinmarketcap(page, limit)
                if cmc_items:
                    _coins_list_cache.set(cache_key, cmc_items, COINS_LIST_CACHE_TTL)
                    return cmc_items
            except Exception:
                pass

    q = db.query(Coin).order_by(Coin.market_cap.desc().nullslast())
    if cat_filter:
        if category_slug and category_slug.lower() in CATEGORY_SLUG_ALTERNATES:
            terms = CATEGORY_SLUG_ALTERNATES[category_slug.lower()]
            q = q.filter(or_(*(Coin.category.ilike(f"%{t}%") for t in terms)))
        else:
            q = q.filter(Coin.category.ilike(f"%{cat_filter}%"))
    offset = (page - 1) * limit if page > 1 else 0
    coins = q.offset(offset).limit(limit).all()

    cg_changes = _fetch_coingecko_price_changes(limit)

    items: List[CoinListItem] = []

    for coin in coins:
        latest_md: Optional[MarketData] = (
            db.query(MarketData)
            .filter(MarketData.coin_id == coin.id)
            .order_by(MarketData.timestamp.desc())
            .first()
        )

        md_point: Optional[MarketDataPoint] = None
        if latest_md:
            pch24 = latest_md.price_change_24h
            pch7 = latest_md.price_change_7d
            if coin.slug in cg_changes:
                cg = cg_changes[coin.slug]
                if pch24 is None and cg.get("price_change_24h") is not None:
                    pch24 = cg["price_change_24h"]
                if pch7 is None and cg.get("price_change_7d") is not None:
                    pch7 = cg["price_change_7d"]

            md_point = MarketDataPoint(
                timestamp=latest_md.timestamp,
                price=latest_md.price,
                market_cap=latest_md.market_cap,
                volume_24h=latest_md.volume_24h,
                price_change_24h=pch24,
                price_change_7d=pch7,
            )
        elif coin.slug in cg_changes:
            cg = cg_changes[coin.slug]
            md_point = MarketDataPoint(
                timestamp=datetime.now(timezone.utc),
                price=coin.price or 0.0,
                market_cap=coin.market_cap,
                volume_24h=coin.volume_24h,
                price_change_24h=cg.get("price_change_24h"),
                price_change_7d=cg.get("price_change_7d"),
            )

        items.append(
            CoinListItem(
                coin=CoinInfo.model_validate(coin),
                latest_market_data=md_point,
            )
        )

    if items:
        _coins_list_cache.set(cache_key, items, COINS_LIST_CACHE_TTL)
    return items


def _enrich_coin_from_coingecko(coin: Coin, db: Session) -> tuple[Coin, list]:
    """Fetch live data from CoinGecko and enrich coin + market_data."""
    from app.services.connectors.coingecko_connector import fetch_coin_details

    try:
        payload = fetch_coin_details(coin.slug, vs_currency="usd")
        coin_data = payload.get("coin", {})
        md_data = payload.get("market_data", {})

        # Update coin metadata for this request (description, links)
        coin.description = coin_data.get("description") or coin.description
        coin.website = coin_data.get("website") or coin.website
        coin.twitter = coin_data.get("twitter") or coin.twitter
        wp = coin_data.get("whitepaper_url")
        if wp and hasattr(coin, "whitepaper_url"):
            coin.whitepaper_url = wp
        exp = coin_data.get("explorer_url")
        if exp and hasattr(coin, "explorer_url"):
            coin.explorer_url = exp
        if coin_data.get("telegram") and hasattr(coin, "telegram"):
            coin.telegram = coin_data.get("telegram")
        coin.price = md_data.get("price") or coin.price
        coin.market_cap = md_data.get("market_cap") or coin.market_cap
        coin.volume_24h = md_data.get("volume_24h") or coin.volume_24h
        if coin_data.get("market_cap_rank") is not None and hasattr(coin, "market_cap_rank"):
            coin.market_cap_rank = coin_data.get("market_cap_rank")

        latest = MarketDataPoint(
            timestamp=datetime.now(timezone.utc),
            price=md_data.get("price") or coin.price or 0.0,
            market_cap=md_data.get("market_cap"),
            volume_24h=md_data.get("volume_24h"),
            price_change_24h=md_data.get("price_change_24h"),
            price_change_7d=md_data.get("price_change_7d"),
        )

        md_rows = (
            db.query(MarketData)
            .filter(MarketData.coin_id == coin.id)
            .order_by(MarketData.timestamp.desc())
            .limit(99)
            .all()
        )
        points = [
            MarketDataPoint(
                timestamp=row.timestamp,
                price=row.price,
                market_cap=row.market_cap,
                volume_24h=row.volume_24h,
                price_change_24h=row.price_change_24h,
                price_change_7d=row.price_change_7d,
            )
            for row in reversed(md_rows)
        ]
        return coin, [latest] + points
    except Exception:
        return coin, []


def _resolve_coin(db: Session, slug_or_symbol: str) -> Optional[Coin]:
    """Resolve slug or symbol (e.g. btc, BTC) to Coin. Tries slug first, then symbol."""
    slug_lower = slug_or_symbol.lower().strip()
    symbol_upper = slug_or_symbol.upper().strip()
    coin = db.query(Coin).filter(Coin.slug == slug_lower).first()
    if coin:
        return coin
    coin = db.query(Coin).filter(Coin.symbol == symbol_upper).first()
    return coin


def _fetch_coin_from_coingecko(slug: str) -> CoinDetailResponse:
    """Fallback: fetch coin directly from CoinGecko when not in DB."""
    from app.services.connectors.coingecko_connector import fetch_coin_details, search_coins

    slug_clean = slug.lower().strip()
    coin_id = slug_clean

    try:
        _coingecko_throttle()
        payload = fetch_coin_details(coin_id, vs_currency="usd")
    except Exception:
        # Slug may differ from CoinGecko id; try search to resolve
        try:
            _coingecko_throttle()
            hits = search_coins(slug_clean)
            if hits and isinstance(hits[0], dict) and hits[0].get("id"):
                coin_id = hits[0]["id"]
                _coingecko_throttle()
                payload = fetch_coin_details(coin_id, vs_currency="usd")
            else:
                raise
        except Exception:
            raise
    c = payload.get("coin") or {}
    md = payload.get("market_data") or {}

    coin_info = CoinInfo(
        id=0,
        name=c.get("name") or slug,
        symbol=(c.get("symbol") or "?").upper(),
        slug=c.get("slug") or slug,
        description=c.get("description"),
        logo_url=c.get("logo_url") if isinstance(c.get("logo_url"), str) else None,
        website=c.get("website"),
        whitepaper_url=c.get("whitepaper_url"),
        explorer_url=c.get("explorer_url"),
        twitter=c.get("twitter"),
        discord=c.get("discord"),
        telegram=c.get("telegram"),
        chain=c.get("chain"),
        category=c.get("category"),
        market_cap_rank=c.get("market_cap_rank"),
        market_cap=c.get("market_cap") or md.get("market_cap"),
        price=c.get("price") or md.get("price"),
        volume_24h=c.get("volume_24h") or md.get("volume_24h"),
        circulating_supply=c.get("circulating_supply"),
        total_supply=c.get("total_supply"),
    )

    md_point = MarketDataPoint(
        timestamp=datetime.now(timezone.utc),
        price=md.get("price") or c.get("price") or 0.0,
        market_cap=md.get("market_cap") or c.get("market_cap"),
        volume_24h=md.get("volume_24h") or c.get("volume_24h"),
        price_change_24h=md.get("price_change_24h"),
        price_change_7d=md.get("price_change_7d"),
    )

    return CoinDetailResponse(
        coin=coin_info,
        market_data=[md_point],
        narratives=[],
        news=[],
    )


@router.get("/{slug}", response_model=CoinDetailResponse)
def get_coin_detail(
    slug: str,
    db: Session = Depends(get_db),
) -> CoinDetailResponse:
    coin = _resolve_coin(db, slug)
    if coin is None:
        try:
            return _fetch_coin_from_coingecko(slug.lower().strip())
        except Exception:
            raise HTTPException(status_code=404, detail="Coin not found")

    # Try to enrich with live CoinGecko data (price, 24h%, 7d%, description, links)
    md_rows = (
        db.query(MarketData)
        .filter(MarketData.coin_id == coin.id)
        .order_by(MarketData.timestamp.desc())
        .limit(100)
        .all()
    )
    md_points = [
        MarketDataPoint(
            timestamp=row.timestamp,
            price=row.price,
            market_cap=row.market_cap,
            volume_24h=row.volume_24h,
            price_change_24h=row.price_change_24h,
            price_change_7d=row.price_change_7d,
        )
        for row in reversed(md_rows)
    ]

    enriched_coin, enriched_md = _enrich_coin_from_coingecko(coin, db)
    if enriched_md:
        coin = enriched_coin
        md_points = enriched_md

    # Narratives
    cn_rows = (
        db.query(CoinNarrative, Narrative)
        .join(Narrative, CoinNarrative.narrative_id == Narrative.id)
        .filter(CoinNarrative.coin_id == coin.id)
        .all()
    )
    narratives = [
        NarrativeRead(
            name=narr.name,
            description=narr.description,
            confidence_score=cn.confidence_score,
        )
        for cn, narr in cn_rows
    ]

    # Related news – naive match on name/symbol in title or summary.
    name_pattern = f"%{coin.name}%"
    symbol_pattern = f"%{coin.symbol}%"
    news_rows = (
        db.query(NewsArticle)
        .filter(
            (NewsArticle.title.ilike(name_pattern))
            | (NewsArticle.title.ilike(symbol_pattern))
            | (NewsArticle.summary.ilike(name_pattern))
            | (NewsArticle.summary.ilike(symbol_pattern))
        )
        .order_by(NewsArticle.published_at.desc().nullslast(), NewsArticle.created_at.desc())
        .limit(10)
        .all()
    )
    news = [
        NewsArticleRead(
            title=row.title,
            source=row.source,
            url=row.url,
            summary=row.summary,
            published_at=row.published_at,
        )
        for row in news_rows
    ]

    return CoinDetailResponse(
        coin=CoinInfo.model_validate(coin),
        market_data=md_points,
        narratives=narratives,
        news=news,
    )


# Map common symbols to CoinGecko ids for chart when coin not in DB
_SYMBOL_TO_COINGECKO_ID: dict[str, str] = {
    "btc": "bitcoin",
    "eth": "ethereum",
    "sol": "solana",
    "bnb": "binancecoin",
    "xrp": "ripple",
    "ada": "cardano",
    "doge": "dogecoin",
    "avax": "avalanche-2",
    "link": "chainlink",
    "dot": "polkadot",
    "matic": "matic-network",
    "uni": "uniswap",
    "atom": "cosmos",
}


@router.get("/{slug}/chart")
def get_coin_chart(
    slug: str,
    days: int = Query(7, ge=1, le=3650, description="Number of days (1-365) or use max via days param"),
) -> dict:
    """Fetch historical price chart from CoinGecko. Uses coin slug from DB or symbol mapping."""
    from app.services.connectors.coingecko_connector import fetch_market_chart

    coin_id = slug.lower().strip()
    # Resolve via DB first for accurate CoinGecko id
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        coin = _resolve_coin(db, slug)
        if coin:
            coin_id = coin.slug
    finally:
        db.close()

    if coin_id not in _SYMBOL_TO_COINGECKO_ID and "-" not in coin_id and len(coin_id) <= 5:
        coin_id = _SYMBOL_TO_COINGECKO_ID.get(coin_id, coin_id)

    try:
        days_param = "max" if days > 365 else days
        data = fetch_market_chart(coin_id, days=days_param)
        prices = data.get("prices") or []
        return {"prices": prices}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Chart data unavailable: {e}")

