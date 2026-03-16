from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AlphaEvent


router = APIRouter(prefix="/api/v1/alpha-feed", tags=["alpha-feed"])


@router.get("")
def get_alpha_feed(
  db: Session = Depends(get_db),
  limit: int = Query(default=50, ge=1, le=200, description="Maximum number of events to return."),
) -> List[dict]:
  """
  Return the latest AlphaEvent records for use in the Alpha Feed / activity UI.

  Results are sorted by created_at descending and limited to the most recent
  `limit` events (default 50).
  """
  rows = (
    db.query(AlphaEvent)
    .order_by(AlphaEvent.created_at.desc())
    .limit(limit)
    .all()
  )

  return [
    {
      "id": row.id,
      "event_type": row.event_type,
      "token_symbol": row.token_symbol,
      "chain": row.chain,
      "summary": row.summary,
      "confidence_score": row.confidence_score,
      "source": row.source,
      "created_at": row.created_at.isoformat() if row.created_at else None,
    }
    for row in rows
  ]

