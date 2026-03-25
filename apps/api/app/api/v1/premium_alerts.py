from __future__ import annotations

from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import PremiumAlertSubscription


router = APIRouter(prefix="/api/v1/premium-alerts", tags=["premium_alerts"])

# Supported alert types (portfolio types for portfolio-based alerts)
AVAILABLE_ALERT_TYPES = [
    "total_score",
    "alpha_score",
    "radar_event_score",
    "signal_alert",
    "portfolio_price_change",
    "portfolio_whale_overlap",
    "portfolio_opportunity",
    "strategy_signal",
    "alpha_followed_user_post",
    "alpha_high_confidence",
    "block70_score_cross",
    "block70_volume_spike",
    "block70_momentum_spike",
]


def _serialize_subscription(sub: PremiumAlertSubscription) -> Dict:
    return {
        "id": sub.id,
        "user_identifier": sub.user_identifier,
        "plan_type": sub.plan_type,
        "alert_types": sub.alert_types,
        "minimum_score": sub.minimum_score,
        "created_at": sub.created_at.isoformat(),
        "updated_at": sub.updated_at.isoformat(),
    }


class PremiumAlertCreate(BaseModel):
    user_identifier: str = Field(..., description="User identifier (e.g. email or wallet ID).")
    plan_type: str = Field(..., description="Plan type: free, pro, elite.")
    alert_types: List[str] = Field(
        ...,
        description="List of metric types to alert on, e.g. total_score, alpha_score, radar_event_score.",
        min_items=1,
    )
    minimum_score: int = Field(
        0,
        ge=0,
        le=100,
        description="Minimum score threshold (0–100) for alerts.",
    )


@router.get("/types")
def list_alert_types() -> Dict:
    """Return available alert types for subscriptions."""
    return {"alert_types": AVAILABLE_ALERT_TYPES}


@router.get("")
def list_premium_alerts(
    db: Session = Depends(get_db),
) -> List[Dict]:
    """
    List all premium alert subscriptions.
    """
    subs = (
        db.query(PremiumAlertSubscription)
        .order_by(PremiumAlertSubscription.created_at.asc())
        .all()
    )
    return [_serialize_subscription(s) for s in subs]


@router.post("")
def create_premium_alert(
    payload: PremiumAlertCreate,
    db: Session = Depends(get_db),
) -> Dict:
    """
    Create a new premium alert subscription.
    """
    sub = PremiumAlertSubscription(
        user_identifier=payload.user_identifier,
        plan_type=payload.plan_type,
        alert_types=payload.alert_types,
        minimum_score=payload.minimum_score,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return _serialize_subscription(sub)


@router.delete("/{subscription_id}")
def delete_premium_alert(
    subscription_id: int = Path(..., description="ID of the premium alert subscription"),
    db: Session = Depends(get_db),
) -> Dict:
    """
    Delete a premium alert subscription by ID.
    """
    sub = (
        db.query(PremiumAlertSubscription)
        .filter(PremiumAlertSubscription.id == subscription_id)
        .first()
    )
    if sub is None:
        raise HTTPException(status_code=404, detail="Premium alert subscription not found")

    db.delete(sub)
    db.commit()

    return {"status": "deleted", "id": subscription_id}

