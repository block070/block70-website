"""Upland-specific Stripe helpers.

Key design decision: Upland Pro / Upland Elite are **add-on SKUs** on top of
the existing global plan. Subscribing to Upland Pro does NOT change the user's
global plan_type; it writes a row into `product_entitlements`.

Webhook routing:
    handle_webhook() (in stripe_service) is the single entrypoint for all
    Stripe events. Before it routes a subscription event into the global
    `subscriptions` table, it calls `upland_tier_from_price_id()` -- if that
    resolves to an Upland tier, we write the event into product_entitlements
    instead.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

import stripe
from sqlalchemy.orm import Session

from app.models import ProductEntitlement, User

UPLAND_PRODUCT_KEY = "upland"
UPLAND_CHECKOUT_TIERS = frozenset({"pro", "elite"})


def _upland_price_env_map() -> dict[str, str]:
    return {
        "pro": "STRIPE_PRICE_UPLAND_PRO",
        "elite": "STRIPE_PRICE_UPLAND_ELITE",
    }


def upland_tier_from_price_id(price_id: str | None) -> str | None:
    """Return 'pro' | 'elite' if the price ID belongs to an Upland SKU.

    Used by the shared webhook dispatcher to route events into the correct
    storage layer. If it returns None, the event is handled by the global
    subscription flow.
    """
    if not price_id:
        return None
    for tier, env_key in _upland_price_env_map().items():
        if os.getenv(env_key) == price_id:
            return tier
    return None


def _get_upland_price_id(tier: str) -> str:
    env_key = _upland_price_env_map().get(tier)
    if not env_key:
        raise ValueError(f"Unsupported Upland tier: {tier}")
    price_id = os.getenv(env_key)
    if not price_id:
        raise RuntimeError(f"{env_key} environment variable is not set")
    return price_id


def create_upland_checkout_session(
    db: Session,
    *,
    user: User,
    tier: str,
    success_url: str,
    cancel_url: str,
) -> stripe.checkout.Session:
    """Create a Stripe Checkout session for Upland Pro or Upland Elite.

    Ensures a ProductEntitlement row exists in 'pending' state so the webhook
    handler can correlate checkout.session.completed back to our DB.
    """
    from app.services.billing.stripe_service import _get_stripe_api_key  # local import to avoid cycle

    stripe.api_key = _get_stripe_api_key()
    t = (tier or "").lower().strip()
    if t not in UPLAND_CHECKOUT_TIERS:
        raise ValueError(f"Invalid Upland tier: {tier}")

    entitlement: Optional[ProductEntitlement] = (
        db.query(ProductEntitlement)
        .filter(
            ProductEntitlement.user_id == user.id,
            ProductEntitlement.product_key == UPLAND_PRODUCT_KEY,
        )
        .order_by(ProductEntitlement.created_at.desc())
        .first()
    )
    if entitlement is None:
        entitlement = ProductEntitlement(
            user_id=user.id,
            product_key=UPLAND_PRODUCT_KEY,
            tier=t,
            status="pending",
        )
        db.add(entitlement)
        db.commit()
        db.refresh(entitlement)
    else:
        entitlement.tier = t
        entitlement.status = "pending"
        db.add(entitlement)
        db.commit()

    price_id = _get_upland_price_id(t)

    subscription_data: dict = {
        "metadata": {
            "user_id": str(user.id),
            "product_key": UPLAND_PRODUCT_KEY,
            "upland_tier": t,
            "entitlement_id": str(entitlement.id),
        },
    }

    try:
        trial_days = int(os.getenv("STRIPE_UPLAND_TRIAL_DAYS", "0"))
    except ValueError:
        trial_days = 0
    if trial_days > 0:
        subscription_data["trial_period_days"] = trial_days

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer_email=user.email,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        subscription_data=subscription_data,
        metadata={
            "user_id": str(user.id),
            "product_key": UPLAND_PRODUCT_KEY,
            "upland_tier": t,
            "entitlement_id": str(entitlement.id),
        },
    )
    return session


# -----------------------------------------------------------------------------
# Webhook handlers -- called from stripe_service.handle_webhook when the event
# is detected to belong to an Upland price.
# -----------------------------------------------------------------------------


def handle_upland_checkout_completed(db: Session, event: stripe.Event) -> None:
    sess = event["data"]["object"]
    meta = sess.get("metadata") or {}
    user_id = meta.get("user_id")
    entitlement_id = meta.get("entitlement_id")
    stripe_sub_id = sess.get("subscription")
    upland_tier = (meta.get("upland_tier") or "").lower().strip()
    if not user_id or not stripe_sub_id or upland_tier not in UPLAND_CHECKOUT_TIERS:
        return

    entitlement: Optional[ProductEntitlement] = None
    if entitlement_id:
        entitlement = db.get(ProductEntitlement, int(entitlement_id))

    if entitlement is None:
        # Fall back to looking up by (user, product) pair.
        entitlement = (
            db.query(ProductEntitlement)
            .filter(
                ProductEntitlement.user_id == int(user_id),
                ProductEntitlement.product_key == UPLAND_PRODUCT_KEY,
            )
            .order_by(ProductEntitlement.created_at.desc())
            .first()
        )
        if entitlement is None:
            entitlement = ProductEntitlement(
                user_id=int(user_id),
                product_key=UPLAND_PRODUCT_KEY,
                tier=upland_tier,
                status="pending",
            )
            db.add(entitlement)

    entitlement.stripe_subscription_id = str(stripe_sub_id)
    entitlement.tier = upland_tier
    entitlement.status = "active"
    db.add(entitlement)
    db.commit()


def handle_upland_subscription_event(
    db: Session, event: stripe.Event, *, upland_tier: str
) -> None:
    data = event["data"]["object"]
    stripe_subscription_id = data["id"]
    status = (data.get("status") or "").lower()
    period_start = data.get("current_period_start")
    period_end = data.get("current_period_end")
    trial_end = data.get("trial_end")
    metadata = data.get("metadata") or {}
    user_id = metadata.get("user_id")

    entitlement: Optional[ProductEntitlement] = (
        db.query(ProductEntitlement)
        .filter(ProductEntitlement.stripe_subscription_id == stripe_subscription_id)
        .first()
    )

    if entitlement is None and user_id:
        entitlement = ProductEntitlement(
            user_id=int(user_id),
            product_key=UPLAND_PRODUCT_KEY,
            tier=upland_tier,
            stripe_subscription_id=stripe_subscription_id,
            status=status,
        )
        db.add(entitlement)
    elif entitlement is not None:
        entitlement.tier = upland_tier
        entitlement.status = status

    if entitlement is None:
        return

    if period_start:
        entitlement.current_period_start = datetime.fromtimestamp(
            int(period_start), tz=timezone.utc
        )
    if period_end:
        entitlement.current_period_end = datetime.fromtimestamp(
            int(period_end), tz=timezone.utc
        )
    if trial_end:
        entitlement.trial_end = datetime.fromtimestamp(
            int(trial_end), tz=timezone.utc
        )

    if status in ("canceled", "unpaid", "incomplete_expired"):
        entitlement.canceled_at = datetime.now(timezone.utc)

    db.add(entitlement)
    db.commit()


def get_active_upland_tier(db: Session, user_id: int) -> str:
    """Return 'pro' | 'elite' if the user holds an active entitlement, else 'free'."""
    ent = (
        db.query(ProductEntitlement)
        .filter(
            ProductEntitlement.user_id == user_id,
            ProductEntitlement.product_key == UPLAND_PRODUCT_KEY,
        )
        .order_by(ProductEntitlement.created_at.desc())
        .first()
    )
    if not ent:
        return "free"
    if ent.status in ("active", "trialing", "past_due") and ent.tier in UPLAND_CHECKOUT_TIERS:
        return ent.tier
    return "free"
