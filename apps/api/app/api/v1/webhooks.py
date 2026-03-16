"""
Webhook registration: create, list, delete. Requires JWT auth.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import User, Webhook
from app.services.api.webhook_delivery import EVENT_NEW_SIGNAL, EVENT_OPPORTUNITY_ALERT, EVENT_WALLET_TRADE

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])

EVENT_TYPES = [EVENT_NEW_SIGNAL, EVENT_WALLET_TRADE, EVENT_OPPORTUNITY_ALERT]


class WebhookCreate(BaseModel):
    url: str
    event_type: str


@router.post("/create", status_code=201)
def create_webhook(
    payload: WebhookCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if payload.event_type not in EVENT_TYPES:
        raise HTTPException(400, f"event_type must be one of: {EVENT_TYPES}")
    wh = Webhook(
        user_id=current_user.id,
        url=payload.url,
        event_type=payload.event_type,
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return {
        "id": wh.id,
        "url": wh.url,
        "event_type": wh.event_type,
        "created_at": (wh.created_at or datetime.now(timezone.utc)).isoformat(),
    }


@router.get("/list")
def list_webhooks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = (
        db.query(Webhook)
        .filter(Webhook.user_id == current_user.id)
        .order_by(Webhook.created_at.desc())
        .all()
    )
    return [
        {
            "id": w.id,
            "url": w.url,
            "event_type": w.event_type,
            "created_at": (w.created_at or datetime.now(timezone.utc)).isoformat(),
        }
        for w in rows
    ]


@router.delete("/{webhook_id}")
def delete_webhook(
    webhook_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    wh = (
        db.query(Webhook)
        .filter(Webhook.id == webhook_id, Webhook.user_id == current_user.id)
        .first()
    )
    if not wh:
        raise HTTPException(404, "Webhook not found")
    db.delete(wh)
    db.commit()
    return {"status": "deleted", "id": webhook_id}
