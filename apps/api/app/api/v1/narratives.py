from __future__ import annotations

from collections import defaultdict
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Opportunity, OpportunityStatus
from app.schemas.narrative_intelligence import (
    NarrativeDailyPoint,
    NarrativeIntelligenceDetail,
    NarrativeIntelligenceListResponse,
    NarrativeIntelligenceRow,
)
from app.schemas.opportunity_db import OpportunityRead
from app.services.narratives import NarrativeEngine
from app.services.narratives.intelligence import (
    BuiltIntelligenceRow,
    compute_intelligence_for_narrative,
    compute_intelligence_rows,
    narrative_by_slug_or_id,
)


router = APIRouter(prefix="/api/v1/narratives", tags=["narratives"])


def _built_to_intelligence_row(b: BuiltIntelligenceRow) -> NarrativeIntelligenceRow:
    n = b.narrative
    return NarrativeIntelligenceRow(
        id=n.id,
        name=n.name,
        description=n.description,
        trend_score=float(n.trend_score or 0.0),
        created_at=n.created_at.isoformat() if n.created_at else None,
        attention=b.attention_recent,
        sentiment=b.sentiment,
        growth_rate=b.growth_rate,
        related_symbols=b.related_symbols,
        daily_series=[
            NarrativeDailyPoint(date=d.isoformat(), attention=float(att))
            for d, att in b.daily_series
        ],
    )


@router.get("")
def list_narratives(
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
) -> List[dict]:
    """Return market narratives (name, description, trend_score)."""
    engine = NarrativeEngine()
    narratives = engine.list_narratives(db, limit=limit)
    return [
        {
            "id": n.id,
            "name": n.name,
            "description": n.description,
            "trend_score": n.trend_score,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in narratives
    ]


@router.get(
    "/intelligence",
    response_model=NarrativeIntelligenceListResponse,
    summary="Narrative intelligence aggregates",
)
def get_narratives_intelligence(
    db: Session = Depends(get_db),
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
        description="Max market narratives to score (by trend_score ordering from list).",
    ),
) -> NarrativeIntelligenceListResponse:
    """
    Dashboard metrics per `MarketNarrative`, derived from active `type=narrative` opportunities.

    **Linking:** each narrative `name` (case-insensitive) must appear in the opportunity
    `title` or `summary` for the row to receive that opportunity's scores.

    - **attention:** sum of `total_score` in the last 7 days (UTC), using `detected_at` or `created_at`.
    - **sentiment:** mean(`upscore - risk_score`) clamped to [-1, 1].
    - **growth_rate:** (attention last 7d − attention prior 7d) / max(prior, ε).
    - **daily_series:** 14 UTC days of per-day attention sums for sparklines.
    """
    built_rows, computed_at = compute_intelligence_rows(db, narrative_limit=limit)
    return NarrativeIntelligenceListResponse(
        narratives=[_built_to_intelligence_row(b) for b in built_rows],
        computed_at=computed_at,
    )


@router.get(
    "/detail",
    response_model=NarrativeIntelligenceDetail,
    summary="Single narrative intelligence + matching opportunities",
)
def get_narrative_detail(
    db: Session = Depends(get_db),
    slug: str | None = Query(
        default=None,
        description="URL-decoded narrative name (e.g. from Next.js dynamic segment).",
    ),
    narrative_id: int | None = Query(
        default=None,
        alias="id",
        description="Optional market narrative id (exact).",
    ),
    opportunity_limit: int = Query(default=100, ge=1, le=200),
) -> NarrativeIntelligenceDetail:
    narrative = narrative_by_slug_or_id(db, slug=slug, narrative_id=narrative_id)
    if narrative is None:
        raise HTTPException(status_code=404, detail="Narrative not found")

    built = compute_intelligence_for_narrative(db, narrative)
    base = _built_to_intelligence_row(built)
    matched_sorted = sorted(
        built.matched,
        key=lambda o: (float(o.total_score or 0.0), o.detected_at or o.created_at),
        reverse=True,
    )[:opportunity_limit]
    op_reads = [
        OpportunityRead.model_validate(o, from_attributes=True)
        for o in matched_sorted
    ]
    return NarrativeIntelligenceDetail(
        **base.model_dump(),
        opportunities=op_reads,
    )


@router.get("/trending", response_model=List[OpportunityRead])
def get_trending_narratives(
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
        description="Maximum number of narrative opportunities to return.",
    ),
    db: Session = Depends(get_db),
) -> List[Opportunity]:
    """
    Return the most recent, highest-scoring narrative opportunities.

    Results are drawn from the shared Opportunity table where type = 'narrative',
    status = 'active', ordered by total_score and detected_at.
    """
    q = (
        db.query(Opportunity)
        .filter(
            Opportunity.type == "narrative",
            Opportunity.status == OpportunityStatus.ACTIVE.value,
        )
        .order_by(Opportunity.total_score.desc(), Opportunity.detected_at.desc())
        .limit(limit)
    )
    return q.all()


@router.get("/tokens")
def get_narratives_by_token(
    limit: int = Query(
        default=10,
        ge=1,
        le=100,
        description="Maximum number of narrative opportunities per token.",
    ),
    db: Session = Depends(get_db),
) -> List[Dict]:
    """
    Group detected narrative opportunities by their anchor token_symbol.

    Returns a list of objects:
    [
      {
        "token_symbol": "TAO",
        "opportunities": [...OpportunityRead...]
      },
      ...
    ]
    """
    q = (
        db.query(Opportunity)
        .filter(
            Opportunity.type == "narrative",
            Opportunity.status == OpportunityStatus.ACTIVE.value,
        )
        .order_by(Opportunity.asset_symbol.asc(), Opportunity.total_score.desc())
    )

    by_token: Dict[str, List[Opportunity]] = defaultdict(list)
    for opp in q.all():
        token = opp.asset_symbol or "UNKNOWN"
        if len(by_token[token]) < limit:
            by_token[token].append(opp)

    results: List[Dict] = []
    for token, opps in by_token.items():
        results.append(
            {
                "token_symbol": token,
                "opportunities": [
                    OpportunityRead.model_validate(o, from_attributes=True) for o in opps
                ],
            }
        )

    return results

