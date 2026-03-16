from __future__ import annotations

from collections import defaultdict
from typing import Dict, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Opportunity, OpportunityStatus
from app.schemas.opportunity_db import OpportunityRead
from app.services.narratives import NarrativeEngine


router = APIRouter(prefix="/api/v1/narratives", tags=["narratives"])


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

