from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import User
from app.services.billing.stripe_service import create_billing_portal_session
from app.services.billing.upland_stripe import (
    UPLAND_CHECKOUT_TIERS,
    create_upland_checkout_session,
)

router = APIRouter(prefix="/api/v1/billing/upland", tags=["upland", "billing"])


class CheckoutIn(BaseModel):
    tier: str = Field(..., description="Upland tier: 'pro' or 'elite'")


@router.post("/create-checkout-session")
def create_checkout(
    payload: CheckoutIn,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    origin = request.headers.get("origin") or request.headers.get("host")
    if not origin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Origin/Host header",
        )
    tier = (payload.tier or "").lower().strip()
    if tier not in UPLAND_CHECKOUT_TIERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tier must be 'pro' or 'elite'",
        )

    scheme = request.url.scheme
    base_url = f"{scheme}://{origin}"
    success_url = f"{base_url}/coins/upland/pricing?checkout=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{base_url}/coins/upland/pricing?checkout=cancel"

    session = create_upland_checkout_session(
        db,
        user=current_user,
        tier=tier,
        success_url=success_url,
        cancel_url=cancel_url,
    )
    return {"url": session.url, "session_id": session.id}


@router.post("/portal")
def open_portal(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> dict:
    origin = request.headers.get("origin") or request.headers.get("host")
    if not origin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Origin/Host header",
        )
    scheme = request.url.scheme
    base_url = f"{scheme}://{origin}"
    session = create_billing_portal_session(
        current_user,
        return_url=f"{base_url}/coins/upland/pricing",
    )
    return {"url": session.url}
