from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Opportunity, OpportunityStatus
from app.schemas.opportunity_db import OpportunityRead


router = APIRouter(prefix="/api/v1/airdrops", tags=["airdrops"])


@router.get("", response_model=List[OpportunityRead])
def list_airdrops(
    db: Session = Depends(get_db),
    limit: int = Query(200, ge=1, le=500),
) -> List[Opportunity]:
    """
    List active + upcoming airdrop opportunities.

    Results are pulled from the shared Opportunity table where type = 'airdrop'.
    We do not limit by `source`: null or legacy source values would otherwise be
    omitted (SQL NULL NOT IN (...)), and non-listed pipelines would show nothing.
    """
    q = (
        db.query(Opportunity)
        .filter(
            Opportunity.type == "airdrop",
            Opportunity.status.in_(
                [OpportunityStatus.ACTIVE.value, OpportunityStatus.UPCOMING.value]
            ),
        )
        .order_by(Opportunity.total_score.desc())
        .limit(limit)
    )
    return q.all()


@router.get("/{id}", response_model=OpportunityRead)
def get_airdrop(
    id: int,
    db: Session = Depends(get_db),
) -> Opportunity:
    """
    Retrieve a single airdrop opportunity by ID.
    """
    opportunity = db.query(Opportunity).filter(
        Opportunity.id == id,
        Opportunity.type == "airdrop",
    ).first()
    if opportunity is None:
        raise HTTPException(status_code=404, detail="Airdrop opportunity not found")
    return opportunity

