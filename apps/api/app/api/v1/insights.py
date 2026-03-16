from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Opportunity, OpportunityStatus
from app.schemas.opportunity_db import OpportunityRead
from app.services.pipeline.digest_generator import generate_digest
from app.services.pipeline.trend_detection import detect_trends


router = APIRouter(prefix="/api/v1/insights", tags=["insights"])


@router.get("/top")
def get_top_insights(db: Session = Depends(get_db)) -> dict:
  """
  Return a digest of top opportunities across arbitrage, mining, and wallets.
  """
  digest = generate_digest(db)
  return digest


@router.get("/trending")
def get_trending_insights(db: Session = Depends(get_db)) -> dict:
  """
  Return trending opportunity signals derived from recent opportunities.
  """
  recent_opps: List[Opportunity] = (
      db.query(Opportunity)
      .filter(Opportunity.status == OpportunityStatus.ACTIVE.value)
      .order_by(Opportunity.detected_at.desc().nullslast(), Opportunity.created_at.desc())
      .limit(200)
      .all()
  )
  trends = detect_trends(recent_opps)
  return {"trends": [t.model_dump() for t in trends]}


@router.get("/highest-roi", response_model=List[OpportunityRead])
def get_highest_roi_insights(db: Session = Depends(get_db)) -> List[Opportunity]:
  """
  Return the highest-ROI active opportunities across all types.
  """
  q = (
      db.query(Opportunity)
      .filter(
          Opportunity.status == OpportunityStatus.ACTIVE.value,
          Opportunity.estimated_roi_percent.isnot(None),
      )
      .order_by(Opportunity.estimated_roi_percent.desc())
      .limit(20)
  )
  return q.all()

