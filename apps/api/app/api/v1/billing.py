from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import Subscription, User
from app.services.billing.stripe_service import (
    CHECKOUT_PLAN_TYPES,
    create_billing_portal_session,
    create_checkout_session,
    handle_webhook,
)


router = APIRouter(prefix="/api/v1/billing", tags=["billing"])


@router.post("/create-checkout-session")
def create_checkout(
    plan_type: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Create a Stripe Checkout session for upgrading a subscription.
    """
    origin = request.headers.get("origin") or request.headers.get("host")
    if not origin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Origin/Host header",
        )

    pt = (plan_type or "").lower().strip()
    if pt not in CHECKOUT_PLAN_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="plan_type must be one of: pro, elite, quant",
        )

    scheme = request.url.scheme
    base_url = f"{scheme}://{origin}"
    success_url = f"{base_url}/usage"
    cancel_url = f"{base_url}/pricing"

    session = create_checkout_session(
        db,
        user=current_user,
        plan_type=pt,
        success_url=success_url,
        cancel_url=cancel_url,
    )
    return {"checkout_url": session.url}


@router.post("/portal")
def create_billing_portal(
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
        return_url=f"{base_url}/usage",
    )
    return {"portal_url": session.url}


@router.get("/subscription")
def get_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    subscription = (
        db.query(Subscription)
        .filter(Subscription.user_id == current_user.id)
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if not subscription:
        return {"status": "none", "plan_type": current_user.plan_type}

    return {
        "id": subscription.id,
        "plan_type": subscription.plan_type,
        "status": subscription.status,
        "current_period_start": subscription.current_period_start,
        "current_period_end": subscription.current_period_end,
    }


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
    db: Session = Depends(get_db),
) -> dict:
    payload = await request.body()
    if not stripe_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe-Signature header",
        )

    try:
        handle_webhook(db, payload=payload, sig_header=stripe_signature)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return {"received": True}

