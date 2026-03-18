from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Opportunity, OpportunityStatus
from app.schemas.opportunity_db import OpportunityRead


router = APIRouter(prefix="/api/v1/airdrops", tags=["airdrops"])

ALLOWED_AIRDROP_SOURCES = {
    "DefiLlama Airdrops",
    "Airdrops.io",
    "DappRadar",
    "ICO Drops",
}


@router.get("", response_model=List[OpportunityRead])
def list_airdrops(
    db: Session = Depends(get_db),
) -> List[Opportunity]:
    """
    List active airdrop opportunities.

    Results are pulled from the shared Opportunity table where type = 'airdrop'
    and sorted by total_score descending.
    """
    q = (
        db.query(Opportunity)
        .filter(
            Opportunity.type == "airdrop",
            Opportunity.status == OpportunityStatus.ACTIVE.value,
            Opportunity.source.in_(sorted(ALLOWED_AIRDROP_SOURCES)),
        )
        .order_by(Opportunity.total_score.desc())
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

