from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session, selectinload

from fastapi import HTTPException

from app.db import get_db
from app.models import AIInsight, AIInsightVote
from app.services.ai import AIInsightEngine


router = APIRouter(prefix="/api/v1/ai", tags=["ai-insights"])


def _insight_to_dict(i: AIInsight) -> dict:
    raw_sources = getattr(i, "sources", None) or []
    sources = [
        {"source_type": s.source_type, "source_id": s.source_id}
        for s in raw_sources
    ]
    return {
        "id": i.id,
        "insight_type": i.insight_type,
        "title": i.title,
        "summary": i.summary,
        "related_tokens": i.related_tokens or [],
        "confidence_score": i.confidence_score,
        "created_at": i.created_at.isoformat() if i.created_at else None,
        "sources": sources,
    }


def _insights_base_query(db: Session):
    return db.query(AIInsight).options(selectinload(AIInsight.sources))


@router.get("/insights")
def list_insights(
    db: Session = Depends(get_db),
    insight_type: str | None = Query(default=None, description="Filter by type"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> List[dict]:
    """List AI-generated insights with optional type filter."""
    q = _insights_base_query(db).order_by(AIInsight.created_at.desc())
    if insight_type:
        q = q.filter(AIInsight.insight_type == insight_type)
    rows = q.offset(offset).limit(limit).all()
    return [_insight_to_dict(r) for r in rows]


@router.get("/insights/top")
def get_top_insights(
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    min_confidence: float = Query(default=0.0, ge=0.0, le=1.0),
) -> List[dict]:
    """Return highest-impact insights (by confidence and recency)."""
    rows = (
        _insights_base_query(db)
        .filter(AIInsight.confidence_score >= min_confidence)
        .order_by(AIInsight.confidence_score.desc(), AIInsight.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_insight_to_dict(r) for r in rows]


@router.get("/insights/latest")
def get_latest_insights(
    db: Session = Depends(get_db),
    limit: int = Query(default=10, ge=1, le=100),
) -> List[dict]:
    """Return the most recent AI insights (for feed)."""
    rows = (
        _insights_base_query(db)
        .order_by(AIInsight.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_insight_to_dict(r) for r in rows]


@router.get("/insights/{token}")
def get_insights_for_token(
    token: str = Path(..., description="Token symbol"),
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
) -> List[dict]:
    """Return AI insights that mention or relate to the given token."""
    token_upper = token.upper()
    all_recent = (
        _insights_base_query(db)
        .order_by(AIInsight.created_at.desc())
        .limit(limit * 3)
        .all()
    )
    rows = [
        i for i in all_recent
        if (i.related_tokens and token_upper in [t.upper() for t in i.related_tokens])
        or (token_upper in (i.title or ""))
        or (token_upper in (i.summary or ""))
    ][:limit]
    return [_insight_to_dict(r) for r in rows]


@router.post("/insights/generate")
def trigger_generate(
    db: Session = Depends(get_db),
    token: str | None = Query(default=None),
    hours: int = Query(default=24, ge=1, le=168),
) -> dict:
    """Trigger insight generation (patterns, trends, narratives). Returns count."""
    engine = AIInsightEngine()
    insights = engine.run(
        db,
        token_symbol=token,
        hours=hours,
        include_patterns=True,
        include_trends=True,
        include_narratives=True,
    )
    return {"generated": len(insights), "insight_ids": [i.id for i in insights]}


@router.post("/insights/seed-examples")
def seed_example_insights(db: Session = Depends(get_db)) -> dict:
    """Seed example AI insights for demo."""
    engine = AIInsightEngine()
    insights = engine.generate_example_insights(db)
    return {"created": len(insights), "insight_ids": [i.id for i in insights]}


@router.post("/insights/{insight_id}/vote")
def vote_insight(
    insight_id: int = Path(...),
    db: Session = Depends(get_db),
    vote: int = Query(..., ge=-1, le=1, description="1=up, -1=down"),
    user_identifier: str = Query(default="anonymous"),
) -> dict:
    """Record a user vote on an AI insight."""
    insight = db.get(AIInsight, insight_id)
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    existing = (
        db.query(AIInsightVote)
        .filter(
            AIInsightVote.insight_id == insight_id,
            AIInsightVote.user_identifier == user_identifier,
        )
        .first()
    )
    if existing:
        existing.vote = vote
        db.commit()
        return {"insight_id": insight_id, "vote": vote, "updated": True}
    v = AIInsightVote(
        insight_id=insight_id,
        user_identifier=user_identifier,
        vote=vote,
    )
    db.add(v)
    db.commit()
    return {"insight_id": insight_id, "vote": vote, "updated": False}
