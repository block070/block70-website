from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Opportunity, OpportunityStatus
from app.schemas.opportunity import OpportunityRead

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


@router.get("/", response_model=List[OpportunityRead])
def list_opportunities(
    type: Optional[str] = Query(default=None, description="Filter by opportunity type"),
    db: Session = Depends(get_db),
) -> List[Opportunity]:
    """
    Return current active opportunities from the database.

    Optional `type` filter allows querying for a specific opportunity type,
    e.g. `arbitrage` or `mining`.
    """
    query = db.query(Opportunity).filter(
        Opportunity.status == OpportunityStatus.ACTIVE.value
    )
    if type:
        query = query.filter(Opportunity.type == type)

    return query.order_by(Opportunity.total_score.desc()).all()

