"""
Daily email digest: top signals, top opportunities, top alpha posts.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session
from typing_extensions import TypedDict

from app.models import Signal, AlphaPost, Opportunity, OpportunityStatus
from app.services.pipeline.digest_generator import generate_digest as generate_opportunity_digest


class TopSignal(TypedDict):
    id: int
    token_symbol: str | None
    signal_type: str
    confidence_score: float
    created_at: str


class TopAlpha(TypedDict):
    id: int
    title: str
    alpha_type: str
    token_symbol: str | None
    confidence_score: float
    created_at: str


class DailyDigestPayload(TypedDict):
    generated_at: str
    top_signals: list[TopSignal]
    top_opportunities: dict
    top_alpha_posts: list[TopAlpha]


def _top_signals(db: Session, limit: int = 5) -> list[TopSignal]:
    since = datetime.now(timezone.utc) - timedelta(days=1)
    rows = (
        db.query(Signal)
        .filter(Signal.created_at >= since)
        .order_by(Signal.confidence_score.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": s.id,
            "token_symbol": s.token_symbol,
            "signal_type": s.signal_type,
            "confidence_score": float(s.confidence_score or 0),
            "created_at": (s.created_at or datetime.now(timezone.utc)).isoformat(),
        }
        for s in rows
    ]


def _top_alpha_posts(db: Session, limit: int = 5) -> list[TopAlpha]:
    since = datetime.now(timezone.utc) - timedelta(days=1)
    rows = (
        db.query(AlphaPost)
        .filter(AlphaPost.created_at >= since)
        .order_by(AlphaPost.confidence_score.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": p.id,
            "title": p.title,
            "alpha_type": p.alpha_type,
            "token_symbol": p.token_symbol,
            "confidence_score": float(p.confidence_score or 0),
            "created_at": (p.created_at or datetime.now(timezone.utc)).isoformat(),
        }
        for p in rows
    ]


def generate_daily_digest(
    db: Session,
    *,
    signals_limit: int = 5,
    alpha_limit: int = 5,
    opportunity_limits: dict | None = None,
) -> DailyDigestPayload:
    """
    Build daily digest payload for email: top signals, opportunities, alpha posts.
    Delivery (sending email) is left to the caller or a separate email sender.
    """
    opp_digest = generate_opportunity_digest(db, **(opportunity_limits or {}))
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "top_signals": _top_signals(db, limit=signals_limit),
        "top_opportunities": opp_digest,
        "top_alpha_posts": _top_alpha_posts(db, limit=alpha_limit),
    }
