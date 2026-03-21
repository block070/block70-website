from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
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


router = APIRouter(prefix="/api/v1/coins", tags=["coins"])


@router.get("", response_model=List[CoinListItem])
def list_coins(
    limit: int = Query(100, ge=1, le=500),
    category: Optional[str] = Query(None, description="Filter by category (e.g. AI, DePIN, Gaming, Layer 2)"),
    db: Session = Depends(get_db),
) -> List[CoinListItem]:
    q = db.query(Coin).order_by(Coin.market_cap.desc().nullslast())
    if category:
        q = q.filter(Coin.category.ilike(f"%{category}%"))
    coins = q.limit(limit).all()

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
            md_point = MarketDataPoint(
                timestamp=latest_md.timestamp,
                price=latest_md.price,
                market_cap=latest_md.market_cap,
                volume_24h=latest_md.volume_24h,
                price_change_24h=latest_md.price_change_24h,
                price_change_7d=latest_md.price_change_7d,
            )

        items.append(
            CoinListItem(
                coin=CoinInfo.model_validate(coin),
                latest_market_data=md_point,
            )
        )

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


@router.get("/{slug}", response_model=CoinDetailResponse)
def get_coin_detail(
    slug: str,
    db: Session = Depends(get_db),
) -> CoinDetailResponse:
    coin = _resolve_coin(db, slug)
    if coin is None:
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
    days: int = Query(7, ge=1, le=365, description="Number of days of history (1, 7, 30, 90, 365)"),
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
        data = fetch_market_chart(coin_id, days=days)
        prices = data.get("prices") or []
        return {"prices": prices}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Chart data unavailable: {e}")

