"""
AI narrative analysis: identify narratives gaining momentum.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from sqlalchemy.orm import Session

from app.models import MarketNarrative


@dataclass
class NarrativeMomentum:
    """A narrative with momentum score."""
    name: str
    description: str | None
    trend_score: float
    direction: str  # rising | stable | falling


class NarrativeAnalyzer:
    """
    Identify narratives gaining momentum from MarketNarrative trend_score
    and optional external signals.
    """

    def analyze(
        self,
        db: Session,
        *,
        min_trend_score: float = 0.3,
        limit: int = 20,
    ) -> List[NarrativeMomentum]:
        """Return narratives ordered by trend_score (momentum)."""
        q = (
            db.query(MarketNarrative)
            .filter(MarketNarrative.trend_score >= min_trend_score)
            .order_by(MarketNarrative.trend_score.desc())
            .limit(limit)
        )
        out = []
        for n in q.all():
            direction = "rising" if (n.trend_score or 0) >= 0.6 else "stable"
            out.append(
                NarrativeMomentum(
                    name=n.name,
                    description=n.description,
                    trend_score=n.trend_score or 0,
                    direction=direction,
                ),
            )
        return out

    def top_momentum(
        self,
        db: Session,
        *,
        limit: int = 5,
    ) -> List[NarrativeMomentum]:
        """Top narratives by momentum (trend_score)."""
        return self.analyze(db, min_trend_score=0.0, limit=limit)
