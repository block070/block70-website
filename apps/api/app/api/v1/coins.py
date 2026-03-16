from __future__ import annotations

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


@router.get("/{slug}", response_model=CoinDetailResponse)
def get_coin_detail(
    slug: str,
    db: Session = Depends(get_db),
) -> CoinDetailResponse:
    coin: Optional[Coin] = (
        db.query(Coin)
        .filter(Coin.slug == slug)
        .first()
    )
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")

    # Market data time series (e.g. last 100 points)
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

