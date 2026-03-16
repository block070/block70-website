"""
Opportunity engine: generate opportunities from signals, wallet activity,
capital flows, and radar alerts.
"""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import MarketOpportunity


class OpportunityEngine:
    """
    Generates and ranks market opportunities using signals, wallet activity,
    capital flows, and radar alerts. Persists MarketOpportunity records.
    """

    def list_opportunities(
        self,
        db: Session,
        *,
        opportunity_type: Optional[str] = None,
        token_symbol: Optional[str] = None,
        limit: int = 50,
    ) -> List[MarketOpportunity]:
        """List market opportunities with optional filters."""
        q = db.query(MarketOpportunity)
        if opportunity_type:
            q = q.filter(MarketOpportunity.opportunity_type == opportunity_type)
        if token_symbol:
            q = q.filter(MarketOpportunity.token_symbol == token_symbol)
        q = q.order_by(
            MarketOpportunity.alpha_score.desc(),
            MarketOpportunity.confidence_score.desc(),
        ).limit(limit)
        return list(q.all())

    def top(
        self,
        db: Session,
        *,
        limit: int = 20,
        min_alpha: float = 0.0,
        min_confidence: float = 0.0,
    ) -> List[MarketOpportunity]:
        """Return highest-scoring opportunities (alpha_score, confidence_score)."""
        q = (
            db.query(MarketOpportunity)
            .filter(MarketOpportunity.alpha_score >= min_alpha)
            .filter(MarketOpportunity.confidence_score >= min_confidence)
            .order_by(
                MarketOpportunity.alpha_score.desc(),
                MarketOpportunity.confidence_score.desc(),
            )
            .limit(limit)
        )
        return list(q.all())

    def emit(
        self,
        db: Session,
        *,
        token_symbol: str,
        opportunity_type: str,
        alpha_score: float = 0.0,
        confidence_score: float = 0.0,
    ) -> MarketOpportunity:
        """Create a market opportunity record."""
        opp = MarketOpportunity(
            token_symbol=token_symbol,
            opportunity_type=opportunity_type,
            alpha_score=alpha_score,
            confidence_score=confidence_score,
        )
        db.add(opp)
        db.commit()
        db.refresh(opp)
        return opp
