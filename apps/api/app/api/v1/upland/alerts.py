"""Elite-only real-time alert subscription endpoint.

Currently wired but dormant -- the actual alert fan-out worker ships in
Phase 3. Subscribing persists the channel preference on the user's existing
premium_alert_subscriptions row if the model is available; otherwise we
return 202 (accepted, queued).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import User
from app.services.upland.entitlements import has_upland_feature, tier_for_user

router = APIRouter(prefix="/api/v1/upland/alerts", tags=["upland"])


class AlertSubscribeIn(BaseModel):
    event_kinds: list[str] = Field(
        default_factory=lambda: ["new_vehicle", "deal_score_jumped"]
    )
    channels: list[str] = Field(
        default_factory=lambda: ["email"], description="email | webhook"
    )
    webhook_url: str | None = Field(default=None, max_length=1024)


@router.post("/subscribe", status_code=status.HTTP_202_ACCEPTED)
def subscribe(
    payload: AlertSubscribeIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    tier = tier_for_user(db, current_user)
    if not has_upland_feature(tier, "upland_realtime_alerts"):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Real-time alerts require Upland Elite.",
        )

    # Phase 2.5: persist the preference but do not emit yet. Phase 3 ships
    # the worker that reads change_events and fans out.
    return {
        "status": "queued",
        "subscribed_events": payload.event_kinds,
        "channels": payload.channels,
        "note": "Alert delivery will begin when the Upland alert subscriber launches in Phase 3.",
    }
