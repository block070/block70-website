"""
Narrative engine: track narrative trends from token performance, news, social signals.
"""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import MarketNarrative


class NarrativeEngine:
    """
    Tracks market narratives and trend scores. Can be fed by token performance,
    news activity, and social signals.
    """

    def list_narratives(
        self,
        db: Session,
        *,
        limit: int = 50,
    ) -> List[MarketNarrative]:
        """Return all market narratives ordered by trend_score desc."""
        q = (
            db.query(MarketNarrative)
            .order_by(MarketNarrative.trend_score.desc())
            .limit(limit)
        )
        return list(q.all())

    def trending(
        self,
        db: Session,
        *,
        min_trend_score: float = 0.0,
        limit: int = 20,
    ) -> List[MarketNarrative]:
        """Return trending narratives (trend_score >= min_trend_score)."""
        q = (
            db.query(MarketNarrative)
            .filter(MarketNarrative.trend_score >= min_trend_score)
            .order_by(MarketNarrative.trend_score.desc())
            .limit(limit)
        )
        return list(q.all())

    def upsert(
        self,
        db: Session,
        name: str,
        description: Optional[str] = None,
        trend_score: float = 0.0,
    ) -> MarketNarrative:
        """Create or update a market narrative by name."""
        existing = db.query(MarketNarrative).filter(
            MarketNarrative.name == name,
        ).first()
        if existing is not None:
            existing.description = description or existing.description
            existing.trend_score = trend_score
            db.commit()
            db.refresh(existing)
            return existing
        n = MarketNarrative(
            name=name,
            description=description,
            trend_score=trend_score,
        )
        db.add(n)
        db.commit()
        db.refresh(n)
        return n
