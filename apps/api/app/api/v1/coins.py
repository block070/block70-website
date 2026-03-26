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
    CoinMarketExtras,
    CoinQuote,
    MarketDataPoint,
    NarrativeRead,
    NewsArticleRead,
)
from app.services.news.cache import TTLCache


router = APIRouter(prefix="/api/v1/coins", tags=["coins"])


COINS_PER_PAGE = 100
TOTAL_COINS_PAGINATED = 10000
TOTAL_PAGES = TOTAL_COINS_PAGINATED // COINS_PER_PAGE  # 100

# CoinGecko free tier returns at most ~500 coins (~5 pages at 100/page).
# Beyond this, use DB directly.
COINGECKO_MAX_PAGE = 5

# Cache coins list to avoid exceeding CoinGecko rate limits (~30/min free tier).
# 90s TTL keeps data fresh while reducing redundant API calls.
_coins_list_cache = TTLCache()
COINS_LIST_CACHE_TTL = 90

# Per-slug cache for `/coins/{slug}` live header: bounds duplicate CG calls (predictable quota).
_coin_header_cg_cache = TTLCache()
COINGECKO_COIN_HEADER_CACHE_TTL = int(os.getenv("COINGECKO_COIN_HEADER_CACHE_TTL", "120"))

# Cached CoinGecko ATH/ATL/supply/FDV/contracts (bounded 2nd fetch when enrichment misses).
_coin_extras_cache = TTLCache()
COINGECKO_EXTRAS_CACHE_TTL = int(os.getenv("COINGECKO_EXTRAS_CACHE_TTL", "600"))

# Minimum seconds between CoinGecko requests to stay under ~30/min.
COINGECKO_MIN_INTERVAL = 2.5
_last_coingecko_call: float = 0


def _detail_with_quote(resp: CoinDetailResponse) -> CoinDetailResponse:
    """Attach canonical quote for frontend hero/chart when a valid price exists."""
    last = resp.market_data[-1] if resp.market_data else None
    price = resp.coin.price
    if price is None or (isinstance(price, (int, float)) and float(price) <= 0):
        if last is not None and last.price is not None:
            try:
                price = float(last.price)
            except (TypeError, ValueError):
                price = None
    if price is None or (isinstance(price, (int, float)) and float(price) <= 0):
        return resp

    mc = resp.coin.market_cap
    if mc is None and last and last.market_cap is not None:
        mc = last.market_cap
    vol = resp.coin.volume_24h
    if vol is None and last and last.volume_24h is not None:
        vol = last.volume_24h
    p24 = last.price_change_24h if last else None
    p7 = last.price_change_7d if last else None

    q = CoinQuote(
        price_usd=float(price),
        market_cap_usd=float(mc) if mc is not None else None,
        volume_24h_usd=float(vol) if vol is not None else None,
        change_24h_pct=float(p24) if p24 is not None else None,
        change_7d_pct=float(p7) if p7 is not None else None,
        as_of=datetime.now(timezone.utc),
        source="block70_api",
        method="coin_row_plus_latest_market_point",
    )
    return resp.model_copy(update={"quote": q})


def _extras_non_empty(me: CoinMarketExtras) -> bool:
    if me.platforms:
        return True
    return any(
        x is not None
        for x in (
            me.ath_usd,
            me.atl_usd,
            me.max_supply,
            me.fully_diluted_valuation_usd,
            me.ath_change_pct_vs_current,
            me.atl_change_pct_vs_current,
            me.ath_date,
            me.atl_date,
        )
    )


def _load_market_extras_cached(slug: str) -> Optional[CoinMarketExtras]:
    """One /coins/{id} worth of stats per slug per TTL (when enrichment did not return extras)."""
    s = (slug or "").lower().strip()
    if not s:
        return None
    key = f"cg:coin_extras:{s}"
    hit = _coin_extras_cache.get(key)
    if hit is not None:
        return hit if _extras_non_empty(hit) else None
    try:
        from app.services.connectors.coingecko_connector import fetch_coin_details

        _coingecko_throttle()
        payload = fetch_coin_details(s, vs_currency="usd")
        raw = payload.get("market_extras")
        me = CoinMarketExtras.model_validate(raw) if raw else CoinMarketExtras()
        _coin_extras_cache.set(key, me, max(60, COINGECKO_EXTRAS_CACHE_TTL))
        return me if _extras_non_empty(me) else None
    except Exception:
        return None


def _coingecko_throttle() -> None:
    """Ensure we don't exceed CoinGecko free tier (~30 req/min)."""
    global _last_coingecko_call
    now = time.time()
    elapsed = now - _last_coingecko_call
    if elapsed < COINGECKO_MIN_INTERVAL and _last_coingecko_call > 0:
        time.sleep(COINGECKO_MIN_INTERVAL - elapsed)
    _last_coingecko_call = time.time()


def _cg_env_truthy(name: str) -> bool:
    return (os.getenv(name) or "").strip().lower() in ("1", "true", "yes", "on")


def _fetch_coin_markets_row_cached(slug: str) -> dict | None:
    """One CoinGecko `/coins/markets` row per slug per TTL window (shared by fallback + optional supplement)."""
    s = (slug or "").lower().strip()
    if not s:
        return None
    key = f"cg:coin_header:{s}"
    cached = _coin_header_cg_cache.get(key)
    if cached is not None:
        return cached
    from app.services.connectors.coingecko_connector import fetch_coin_markets_row_by_id

    _coingecko_throttle()
    row = fetch_coin_markets_row_by_id(s)
    if row:
        _coin_header_cg_cache.set(key, row, max(30, COINGECKO_COIN_HEADER_CACHE_TTL))
    return row


def _exchange_row_wants_cg_topup(row: dict) -> bool:
    """
    When exchange-first pricing exists, only call CoinGecko for obvious gaps so we
    do not burn quota on every Binance row (those often omit 7d / market_cap).
    """
    if row.get("current_price") is None:
        return False
    if row.get("_source") == "coinbase":
        return True
    return row.get("price_change_percentage_24h") is None


def _merge_coingecko_header_gaps(exchange_row: dict, cg_row: dict | None) -> dict:
    """Keep exchange `current_price`; fill missing 24h/7d/volume/mcap from CoinGecko when present."""
    if not cg_row:
        return exchange_row
    out = dict(exchange_row)
    if out.get("price_change_percentage_24h") is None:
        v = cg_row.get("price_change_percentage_24h")
        if v is not None:
            out["price_change_percentage_24h"] = v
    if out.get("price_change_percentage_7d_in_currency") is None:
        v = cg_row.get("price_change_percentage_7d_in_currency") or cg_row.get("price_change_percentage_7d")
        if v is not None:
            out["price_change_percentage_7d_in_currency"] = v
    if out.get("total_volume") is None:
        v = cg_row.get("total_volume")
        if v is not None:
            out["total_volume"] = v
    if out.get("market_cap") is None:
        v = cg_row.get("market_cap")
        if v is not None:
            out["market_cap"] = v
    return out


def _enrich_md_points_tail_from_cg_markets(
    md_points: list[MarketDataPoint],
    row: dict | None,
) -> None:
    """Fill missing price, mcap, volume, % from CoinGecko /coins/markets row."""
    if not row or not md_points:
        return
    last = md_points[-1]
    price = last.price
    try:
        if price is None or float(price) <= 0:
            p = row.get("current_price")
            if p is not None:
                price = float(p)
    except (TypeError, ValueError):
        price = last.price
    mcap = last.market_cap
    if mcap is None:
        v = row.get("market_cap")
        if v is not None:
            try:
                mcap = float(v)
            except (TypeError, ValueError):
                mcap = None
    vol = last.volume_24h
    if vol is None:
        v = row.get("total_volume")
        if v is not None:
            try:
                vol = float(v)
            except (TypeError, ValueError):
                vol = None
    p24 = last.price_change_24h
    if p24 is None:
        p24 = row.get("price_change_percentage_24h")
    p7 = last.price_change_7d
    if p7 is None:
        p7 = row.get("price_change_percentage_7d_in_currency") or row.get(
            "price_change_percentage_7d"
        )
    try:
        px = float(price) if price is not None else float(last.price or 0)
    except (TypeError, ValueError):
        px = float(last.price or 0)
    md_points[-1] = MarketDataPoint(
        timestamp=last.timestamp,
        price=px,
        market_cap=mcap,
        volume_24h=vol,
        price_change_24h=p24,
        price_change_7d=p7,
    )


def _merge_coin_info_from_cg_markets_row(ci: CoinInfo, row: dict | None) -> CoinInfo:
    """Fill null hero fields from a /coins/markets row (cached per slug)."""
    if not row:
        return ci
    patch: dict = {}
    try:
        if ci.price is None or float(ci.price or 0) <= 0:
            v = row.get("current_price")
            if v is not None and float(v) > 0:
                patch["price"] = float(v)
    except (TypeError, ValueError):
        pass
    if ci.market_cap is None:
        v = row.get("market_cap")
        if v is not None:
            try:
                patch["market_cap"] = float(v)
            except (TypeError, ValueError):
                pass
    if ci.volume_24h is None:
        v = row.get("total_volume")
        if v is not None:
            try:
                patch["volume_24h"] = float(v)
            except (TypeError, ValueError):
                pass
    if ci.market_cap_rank is None:
        v = row.get("market_cap_rank")
        if v is not None:
            try:
                patch["market_cap_rank"] = int(v)
            except (TypeError, ValueError):
                pass
    if ci.circulating_supply is None:
        v = row.get("circulating_supply")
        if v is not None:
            try:
                patch["circulating_supply"] = float(v)
            except (TypeError, ValueError):
                pass
    if ci.total_supply is None:
        v = row.get("total_supply")
        if v is not None:
            try:
                patch["total_supply"] = float(v)
            except (TypeError, ValueError):
                pass
    img = row.get("image")
    if isinstance(img, dict):
        img = img.get("large") or img.get("small")
    if isinstance(img, str) and img.strip() and not ci.logo_url:
        patch["logo_url"] = img.strip()
    if patch:
        return ci.model_copy(update=patch)
    return ci


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

    # When no category filter: For pages beyond CoinGecko limit (6+), use DB directly.
    # CoinGecko free API returns at most ~500 coins (~5 pages). Pages 25-99 require DB.
    if cat_filter is None:
        if page <= COINGECKO_MAX_PAGE:
            try:
                cg_items = _fetch_coins_from_coingecko(page, limit)
                if cg_items:
                    _coins_list_cache.set(cache_key, cg_items, COINS_LIST_CACHE_TTL)
                    return cg_items
            except Exception:
                pass

            # Try CoinMarketCap fallback when CMC_API_KEY is set (pages 1-5 only)
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
            parts = [Coin.category.ilike(f"%{t}%") for t in terms]
            if hasattr(Coin, "category_slug") and category_slug.strip():
                parts.insert(0, Coin.category_slug == category_slug.lower().strip())
            q = q.filter(or_(*parts))
        elif category_slug and hasattr(Coin, "category_slug") and category_slug.strip():
            slug_low = category_slug.lower().strip()
            q = q.filter(
                or_(Coin.category_slug == slug_low, Coin.category.ilike(f"%{cat_filter}%"))
            )
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


def _enrich_coin_from_coingecko(coin: Coin, db: Session) -> tuple[Coin, list, Optional[CoinMarketExtras]]:
    """Fetch live data from CoinGecko and enrich coin + market_data + optional ATH/ATL/FDV/contracts."""
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
        if coin_data.get("category"):
            coin.category = coin_data.get("category")
        if coin_data.get("category_slug") and hasattr(coin, "category_slug"):
            coin.category_slug = coin_data.get("category_slug")
        cs = coin_data.get("circulating_supply")
        if cs is not None:
            try:
                coin.circulating_supply = float(cs)
            except (TypeError, ValueError):
                pass
        ts = coin_data.get("total_supply")
        if ts is not None:
            try:
                coin.total_supply = float(ts)
            except (TypeError, ValueError):
                pass

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
        try:
            db.commit()
        except Exception:
            db.rollback()
        extras: CoinMarketExtras | None = None
        raw_ex = payload.get("market_extras")
        if raw_ex:
            try:
                extras = CoinMarketExtras.model_validate(raw_ex)
            except Exception:
                extras = None
        return coin, [latest] + points, extras
    except Exception:
        return coin, [], None


def _persist_coin_from_coingecko(
    db: Session, slug: str, response: CoinDetailResponse
) -> None:
    """Persist coin from CoinGecko fallback so we have description for next visit."""
    try:
        c = response.coin
        existing = db.query(Coin).filter(Coin.slug == slug).first()
        if existing:
            if c.description and not (existing.description or "").strip():
                existing.description = c.description
            existing.website = c.website or existing.website
            existing.whitepaper_url = c.whitepaper_url or existing.whitepaper_url
            existing.explorer_url = c.explorer_url or existing.explorer_url
            existing.twitter = c.twitter or existing.twitter
            existing.discord = c.discord or existing.discord
            if hasattr(existing, "telegram"):
                existing.telegram = getattr(c, "telegram", None) or existing.telegram
            if c.category:
                existing.category = c.category
            if getattr(c, "category_slug", None) and hasattr(existing, "category_slug"):
                existing.category_slug = c.category_slug
        else:
            coin = Coin(
                name=c.name,
                symbol=c.symbol,
                slug=c.slug,
                description=c.description,
                logo_url=c.logo_url,
                website=c.website,
                whitepaper_url=c.whitepaper_url,
                explorer_url=c.explorer_url,
                twitter=c.twitter,
                discord=c.discord,
                telegram=getattr(c, "telegram", None),
                category=c.category,
                category_slug=getattr(c, "category_slug", None),
                market_cap_rank=c.market_cap_rank,
                market_cap=c.market_cap,
                price=c.price,
                volume_24h=c.volume_24h,
                circulating_supply=c.circulating_supply,
                total_supply=c.total_supply,
            )
            db.add(coin)
        db.commit()
    except Exception:
        db.rollback()


def _resolve_coin(db: Session, slug_or_symbol: str) -> Optional[Coin]:
    """Resolve slug or symbol (e.g. btc, BTC) to Coin. Tries slug first, then symbol."""
    slug_lower = slug_or_symbol.lower().strip()
    symbol_upper = slug_or_symbol.upper().strip()
    coin = db.query(Coin).filter(Coin.slug == slug_lower).first()
    if coin:
        return coin
    coin = db.query(Coin).filter(Coin.symbol == symbol_upper).first()
    return coin


def _fetch_coin_from_markets(slug: str) -> Optional[CoinDetailResponse]:
    """
    Fallback: find coin in CoinGecko /coins/markets (same source as /coins list).
    Returns price, 24h, 7d, market cap, 24h volume for coins that appear on the list.
    """
    from app.services.connectors.coingecko_connector import fetch_all_coins

    slug_lower = slug.lower().strip()
    for page in range(1, TOTAL_PAGES + 1):
        try:
            _coingecko_throttle()
            items = fetch_all_coins(vs_currency="usd", per_page=COINS_PER_PAGE, page=page)
            for cg in items:
                if (cg.get("slug") or "").lower() == slug_lower:
                    coin_info = CoinInfo(
                        id=cg.get("market_cap_rank") or 0,
                        name=cg.get("name") or slug_lower,
                        symbol=(cg.get("symbol") or "?").upper(),
                        slug=cg.get("slug") or slug_lower,
                        description=None,
                        logo_url=cg.get("logo_url"),
                        website=None,
                        whitepaper_url=None,
                        explorer_url=None,
                        twitter=None,
                        discord=None,
                        telegram=None,
                        chain=None,
                        category=None,
                        category_slug=None,
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
                    return _detail_with_quote(
                        CoinDetailResponse(
                            coin=coin_info,
                            market_data=[md_point],
                            narratives=[],
                            news=[],
                            market_extras=None,
                        )
                    )
        except Exception:
            break
    return None


def _make_stub_coin_response(slug: str) -> CoinDetailResponse:
    """Return a minimal valid coin page so /coins/{slug} never 404s."""
    name = slug.replace("-", " ").replace("_", " ").title()
    symbol = (slug.split("-")[0][:10] if "-" in slug else slug[:10]).upper()
    coin_info = CoinInfo(
        id=0,
        name=name,
        symbol=symbol,
        slug=slug,
        description=None,
        logo_url=None,
        website=None,
        whitepaper_url=None,
        explorer_url=None,
        twitter=None,
        discord=None,
        telegram=None,
        chain=None,
        category=None,
        category_slug=None,
        market_cap_rank=None,
        market_cap=None,
        price=None,
        volume_24h=None,
        circulating_supply=None,
        total_supply=None,
    )
    md_point = MarketDataPoint(
        timestamp=datetime.now(timezone.utc),
        price=0.0,
        market_cap=None,
        volume_24h=None,
        price_change_24h=None,
        price_change_7d=None,
    )
    return _detail_with_quote(
        CoinDetailResponse(
            coin=coin_info,
            market_data=[md_point],
            narratives=[],
            news=[],
            market_extras=None,
        )
    )


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
        category_slug=c.get("category_slug"),
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
    market_extras: Optional[CoinMarketExtras] = None
    raw_extras = payload.get("market_extras")
    if raw_extras:
        try:
            market_extras = CoinMarketExtras.model_validate(raw_extras)
        except Exception:
            market_extras = None

    return _detail_with_quote(
        CoinDetailResponse(
            coin=coin_info,
            market_data=[md_point],
            narratives=[],
            news=[],
            market_extras=market_extras if (market_extras and _extras_non_empty(market_extras)) else None,
        )
    )


@router.get("/{slug}", response_model=CoinDetailResponse)
def get_coin_detail(
    slug: str,
    db: Session = Depends(get_db),
) -> CoinDetailResponse:
    coin = _resolve_coin(db, slug)
    if coin is None:
        try:
            response = _fetch_coin_from_coingecko(slug.lower().strip())
            _persist_coin_from_coingecko(db, slug.lower().strip(), response)
            return response
        except Exception:
            pass
        # Same source as /coins list: fetch from markets so price, 24h, 7d, market cap, volume are available
        markets_response = _fetch_coin_from_markets(slug.lower().strip())
        if markets_response is not None:
            return markets_response
        return _make_stub_coin_response(slug.lower().strip())

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

    market_extras: Optional[CoinMarketExtras] = None
    enriched_coin, enriched_md, extras_from_cg = _enrich_coin_from_coingecko(coin, db)
    if enriched_md:
        coin = enriched_coin
        md_points = enriched_md
        market_extras = extras_from_cg
    elif not md_points:
        # No MarketData and enrichment failed; use markets (same source as /coins list)
        markets_response = _fetch_coin_from_markets(coin.slug)
        if markets_response is not None and markets_response.market_data:
            md_points = markets_response.market_data
            mc = markets_response.coin
            if mc.price is not None:
                coin.price = mc.price
            if mc.market_cap is not None:
                coin.market_cap = mc.market_cap
            if mc.volume_24h is not None:
                coin.volume_24h = mc.volume_24h
            if mc.market_cap_rank is not None:
                coin.market_cap_rank = mc.market_cap_rank
            if mc.logo_url and not coin.logo_url:
                coin.logo_url = mc.logo_url

    # Fast live header when DB/enrichment is stale: exchanges first (Binance.com → Coinbase → Binance.US),
    # then CoinGecko /coins/markets only if snapshot has no price. Optional supplement (off by default):
    # COINGECKO_COIN_HEADER_SUPPLEMENT=1 — one cached CG row per slug to fill gaps (e.g. Coinbase spot + CG 24h)
    # without replacing exchange price; CG calls still throttled and deduped via TTL cache.
    market_row: dict | None = None
    tail_weak = True
    if md_points:
        try:
            lp = md_points[-1].price
            tail_weak = lp is None or float(lp) <= 0
        except Exception:
            tail_weak = True
    if tail_weak:
        try:
            from app.services.connectors.coin_market_snapshot import fetch_exchange_first_market_snapshot

            market_row = fetch_exchange_first_market_snapshot(coin.slug, coin.symbol)
        except Exception:
            market_row = None
        if (
            market_row
            and market_row.get("current_price") is not None
            and _cg_env_truthy("COINGECKO_COIN_HEADER_SUPPLEMENT")
            and _exchange_row_wants_cg_topup(market_row)
        ):
            try:
                cg_row = _fetch_coin_markets_row_cached(coin.slug)
                market_row = _merge_coingecko_header_gaps(market_row, cg_row)
            except Exception:
                pass
        if not market_row or market_row.get("current_price") is None:
            try:
                market_row = _fetch_coin_markets_row_cached(coin.slug)
            except Exception:
                market_row = None
        if market_row and market_row.get("current_price") is not None:
            try:
                px = float(market_row["current_price"])
                if px > 0:
                    md_points = [
                        MarketDataPoint(
                            timestamp=datetime.now(timezone.utc),
                            price=px,
                            market_cap=market_row.get("market_cap"),
                            volume_24h=market_row.get("total_volume"),
                            price_change_24h=market_row.get("price_change_percentage_24h"),
                            price_change_7d=market_row.get("price_change_percentage_7d_in_currency")
                            or market_row.get("price_change_percentage_7d"),
                        )
                    ]
            except (TypeError, ValueError):
                pass

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

    coin_info = CoinInfo.model_validate(coin)
    cg_fill: dict | None = None
    try:
        cg_fill = _fetch_coin_markets_row_cached(coin.slug)
    except Exception:
        cg_fill = None
    if cg_fill:
        _enrich_md_points_tail_from_cg_markets(md_points, cg_fill)
        if not md_points:
            try:
                px = float(cg_fill.get("current_price") or 0)
                if px > 0:
                    md_points = [
                        MarketDataPoint(
                            timestamp=datetime.now(timezone.utc),
                            price=px,
                            market_cap=cg_fill.get("market_cap"),
                            volume_24h=cg_fill.get("total_volume"),
                            price_change_24h=cg_fill.get("price_change_percentage_24h"),
                            price_change_7d=cg_fill.get("price_change_percentage_7d_in_currency")
                            or cg_fill.get("price_change_percentage_7d"),
                        )
                    ]
            except (TypeError, ValueError):
                pass
        coin_info = _merge_coin_info_from_cg_markets_row(coin_info, cg_fill)

    if md_points:
        try:
            latest = md_points[-1]
            lp = float(latest.price)
            if lp > 0:
                patch: dict = {"price": lp}
                if latest.market_cap is not None:
                    patch["market_cap"] = float(latest.market_cap)
                if latest.volume_24h is not None:
                    patch["volume_24h"] = float(latest.volume_24h)
                row_src = market_row or cg_fill
                if row_src:
                    sym = row_src.get("symbol")
                    if sym:
                        patch["symbol"] = str(sym).upper()
                    rnk = row_src.get("market_cap_rank")
                    if rnk is not None:
                        patch["market_cap_rank"] = int(rnk)
                    img = row_src.get("image")
                    if isinstance(img, dict):
                        img = img.get("large") or img.get("small")
                    if isinstance(img, str) and img.strip() and not coin_info.logo_url:
                        patch["logo_url"] = img.strip()
                coin_info = coin_info.model_copy(update=patch)
        except (TypeError, ValueError):
            pass

    if market_extras is None or not _extras_non_empty(market_extras):
        extra_fallback = _load_market_extras_cached(coin.slug)
        if extra_fallback:
            market_extras = extra_fallback

    return _detail_with_quote(
        CoinDetailResponse(
            coin=coin_info,
            market_data=md_points,
            narratives=narratives,
            news=news,
            market_extras=market_extras if (market_extras and _extras_non_empty(market_extras)) else None,
        )
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
    """Fetch historical price chart. Storage → Binance.US → CoinGecko. Persists on API success."""
    from app.services.chart_service import fetch_market_chart

    coin_id = slug.lower().strip()
    symbol_override: str | None = None
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        coin = _resolve_coin(db, slug)
        if coin:
            coin_id = coin.slug
            symbol_override = coin.symbol
    finally:
        db.close()

    if coin_id not in _SYMBOL_TO_COINGECKO_ID and "-" not in coin_id and len(coin_id) <= 5:
        coin_id = _SYMBOL_TO_COINGECKO_ID.get(coin_id, coin_id)

    try:
        days_param = "max" if days > 365 else days
        data = fetch_market_chart(coin_id, days=days_param, symbol_override=symbol_override)
        prices = data.get("prices") or []
        return {"prices": prices}
    except Exception as e:
        # Return empty chart instead of 502 so frontend shows "No chart data" vs error
        return {"prices": [], "message": "Chart temporarily unavailable (rate limit). Try again later."}

