from __future__ import annotations

"""
Internal linking engine for Block70.

This module computes relationships that can be used by the API or frontend to
surface rich internal links between:
- coins and narratives
- coins and related coins
- coins and news articles

It does not mutate the database; instead it exposes helper functions that
return structured link suggestions given a SQLAlchemy session and a Coin.
"""

from typing import List, Tuple

from sqlalchemy.orm import Session

from app.models import (
    Coin,
    CoinNarrative,
    Narrative,
    NewsArticle,
    TrendingCoin,
)


def get_coin_narrative_links(db: Session, coin: Coin) -> List[Tuple[Narrative, float]]:
    """
    Return narratives and confidence scores for a given coin.

    This wraps the CoinNarrative join so callers can easily build
    internal links like:
    - /narratives/{slugified_name}
    - narrative filter chips on the coin page
    """
    rows = (
        db.query(CoinNarrative, Narrative)
        .join(Narrative, CoinNarrative.narrative_id == Narrative.id)
        .filter(CoinNarrative.coin_id == coin.id)
        .order_by(CoinNarrative.confidence_score.desc())
        .all()
    )
    return [(narr, cn.confidence_score) for cn, narr in rows]


def get_related_coins(
    db: Session,
    coin: Coin,
    *,
    limit: int = 10,
) -> List[Coin]:
    """
    Compute related coins for internal linking on a coin page.

    Heuristics:
    - Prefer coins that share narratives
    - Fallback to same category or chain if no narratives
    - Optionally weight by TrendingCoin.trend_score
    """
    # 1) Shared narratives
    cn_rows = (
        db.query(CoinNarrative)
        .filter(CoinNarrative.coin_id == coin.id)
        .all()
    )
    narrative_ids = [cn.narrative_id for cn in cn_rows]

    if narrative_ids:
        related_by_narrative = (
            db.query(Coin)
            .join(CoinNarrative, CoinNarrative.coin_id == Coin.id)
            .filter(
                CoinNarrative.narrative_id.in_(narrative_ids),
                Coin.id != coin.id,
            )
            .distinct()
            .limit(limit)
            .all()
        )
        if related_by_narrative:
            return related_by_narrative

    # 2) Fallback: same category or chain
    query = db.query(Coin).filter(Coin.id != coin.id)
    if coin.category:
        query = query.filter(Coin.category == coin.category)
    elif coin.chain:
        query = query.filter(Coin.chain == coin.chain)

    related = (
        query.order_by(Coin.market_cap.desc().nullslast())
        .limit(limit)
        .all()
    )
    return related


def get_coin_news_links(
    db: Session,
    coin: Coin,
    *,
    limit: int = 10,
) -> List[NewsArticle]:
    """
    Return news articles most likely related to a given coin.

    Matching heuristic:
    - title or summary contains the coin name or symbol (ILIKE)
    """
    name_pattern = f"%{coin.name}%"
    symbol_pattern = f"%{coin.symbol}%"
    return (
        db.query(NewsArticle)
        .filter(
            (NewsArticle.title.ilike(name_pattern))
            | (NewsArticle.title.ilike(symbol_pattern))
            | (NewsArticle.summary.ilike(name_pattern))
            | (NewsArticle.summary.ilike(symbol_pattern))
        )
        .order_by(NewsArticle.published_at.desc().nullslast(), NewsArticle.created_at.desc())
        .limit(limit)
        .all()
    )


def get_trending_related_coins(
    db: Session,
    coin: Coin,
    *,
    limit: int = 5,
) -> List[Coin]:
    """
    Return other trending coins to link from a given coin page.

    This is useful for "Users also watched" style blocks that stay within the
    same discovery surface.
    """
    trending_rows = (
        db.query(TrendingCoin)
        .filter(TrendingCoin.coin_id != coin.id)
        .order_by(TrendingCoin.trend_score.desc())
        .limit(limit)
        .all()
    )
    coin_ids = [row.coin_id for row in trending_rows]
    if not coin_ids:
        return []

    return (
        db.query(Coin)
        .filter(Coin.id.in_(coin_ids))
        .all()
    )

