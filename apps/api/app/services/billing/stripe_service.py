from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

import stripe
from sqlalchemy.orm import Session

from app.models import Subscription, User

CHECKOUT_PLAN_TYPES = frozenset({"pro", "elite", "quant"})


def _get_stripe_api_key() -> str:
    api_key = os.getenv("STRIPE_API_KEY")
    if not api_key:
        raise RuntimeError("STRIPE_API_KEY environment variable is not set")
    return api_key


def _get_stripe_webhook_secret() -> str:
    secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET environment variable is not set")
    return secret


def _stripe_price_env_map() -> dict[str, str]:
    return {
        "pro": "STRIPE_PRICE_PRO",
        "elite": "STRIPE_PRICE_ELITE",
        "quant": "STRIPE_PRICE_QUANT",
    }


def _get_price_for_plan(plan_type: str) -> str:
    env_key = _stripe_price_env_map().get(plan_type)
    if not env_key:
        raise ValueError(f"Unsupported plan type for checkout: {plan_type}")
    price_id = os.getenv(env_key)
    if not price_id:
        raise RuntimeError(f"{env_key} environment variable is not set")
    return price_id


def plan_from_stripe_price_id(price_id: str | None) -> str | None:
    if not price_id:
        return None
    for plan, env_key in _stripe_price_env_map().items():
        if os.getenv(env_key) == price_id:
            return plan
    return None


def create_customer(user: User) -> stripe.Customer:
    stripe.api_key = _get_stripe_api_key()
    customer = stripe.Customer.create(
        email=user.email,
        metadata={"user_id": str(user.id)},
    )
    return customer


def create_checkout_session(
    db: Session,
    *,
    user: User,
    plan_type: str,
    success_url: str,
    cancel_url: str,
) -> stripe.checkout.Session:
    stripe.api_key = _get_stripe_api_key()
    pt = plan_type.lower().strip()
    if pt not in CHECKOUT_PLAN_TYPES:
        raise ValueError(f"Invalid plan_type: {plan_type}")

    subscription: Optional[Subscription] = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .order_by(Subscription.created_at.desc())
        .first()
    )

    if subscription is None:
        subscription = Subscription(
            user_id=user.id,
            plan_type=pt,
            status="pending",
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)

    price_id = _get_price_for_plan(pt)

    subscription_data: dict = {
        "metadata": {"user_id": str(user.id), "plan_type": pt},
    }
    if pt == "elite":
        try:
            trial_days = int(os.getenv("STRIPE_ELITE_TRIAL_DAYS", "7"))
        except ValueError:
            trial_days = 7
        if trial_days > 0:
            subscription_data["trial_period_days"] = trial_days

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer_email=user.email,
        line_items=[
            {
                "price": price_id,
                "quantity": 1,
            }
        ],
        success_url=success_url,
        cancel_url=cancel_url,
        subscription_data=subscription_data,
        metadata={
            "user_id": str(user.id),
            "plan_type": pt,
            "subscription_db_id": str(subscription.id),
        },
    )
    return session


def cancel_subscription(db: Session, *, user: User) -> None:
    stripe.api_key = _get_stripe_api_key()
    subscription: Optional[Subscription] = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if subscription is None or not subscription.stripe_subscription_id:
        return

    stripe.Subscription.delete(subscription.stripe_subscription_id)
    subscription.status = "canceled"
    db.add(subscription)
    db.commit()


def create_billing_portal_session(
    user: User,
    *,
    return_url: str,
) -> stripe.billing_portal.Session:
    stripe.api_key = _get_stripe_api_key()
    customer = stripe.Customer.list(email=user.email, limit=1)
    if not customer.data:
        raise RuntimeError("Stripe customer not found for user")

    portal_session = stripe.billing_portal.Session.create(
        customer=customer.data[0].id,
        return_url=return_url,
    )
    return portal_session


def handle_webhook(db: Session, *, payload: bytes, sig_header: str) -> None:
    stripe.api_key = _get_stripe_api_key()
    webhook_secret = _get_stripe_webhook_secret()

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except stripe.error.SignatureVerificationError as exc:
        raise ValueError("Invalid Stripe webhook signature") from exc

    # -- Route Upland add-on SKUs into product_entitlements ----------------
    from app.services.billing.upland_stripe import (  # local import to avoid cycle
        handle_upland_checkout_completed,
        handle_upland_subscription_event,
        upland_tier_from_price_id,
    )

    data_obj = event.get("data", {}).get("object", {}) or {}
    upland_tier: str | None = None
    metadata = (data_obj.get("metadata") or {})
    if metadata.get("product_key") == "upland":
        upland_tier = (metadata.get("upland_tier") or "").lower().strip() or None

    if upland_tier is None:
        line_items = (
            data_obj.get("items", {}).get("data", [])
            or data_obj.get("line_items", {}).get("data", [])
            or []
        )
        for item in line_items:
            price_obj = item.get("price") or {}
            maybe = upland_tier_from_price_id(price_obj.get("id"))
            if maybe:
                upland_tier = maybe
                break

    if upland_tier:
        if event["type"] == "checkout.session.completed":
            handle_upland_checkout_completed(db, event)
            return
        if event["type"] in {
            "customer.subscription.created",
            "customer.subscription.updated",
            "customer.subscription.deleted",
        }:
            handle_upland_subscription_event(db, event, upland_tier=upland_tier)
            return
        # Unhandled Upland events fall through silently (no-op).
        return

    # -- Global plan events ------------------------------------------------
    if event["type"] == "checkout.session.completed":
        _handle_checkout_session_completed(db, event)
        return

    if event["type"] in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }:
        _handle_subscription_event(db, event)


def _handle_checkout_session_completed(db: Session, event: stripe.Event) -> None:
    sess = event["data"]["object"]
    meta = sess.get("metadata") or {}
    user_id = meta.get("user_id")
    plan_type = (meta.get("plan_type") or "pro").lower().strip()
    sub_db_id = meta.get("subscription_db_id")
    stripe_sub_id = sess.get("subscription")
    if not user_id or not sub_db_id or not stripe_sub_id:
        return

    subscription = db.get(Subscription, int(sub_db_id))
    if subscription is None:
        return
    subscription.stripe_subscription_id = str(stripe_sub_id)
    subscription.plan_type = plan_type
    subscription.status = "active"
    db.add(subscription)

    user = db.get(User, int(user_id))
    if user:
        user.plan_type = plan_type
        user.subscription_status = "active"
        db.add(user)
    db.commit()


def _resolve_plan_from_subscription_payload(data: dict) -> str | None:
    meta = data.get("metadata") or {}
    plan = meta.get("plan_type")
    items = data.get("items", {}).get("data", [])
    if items:
        price_obj = items[0].get("price") or {}
        price_id = price_obj.get("id")
        mapped = plan_from_stripe_price_id(price_id)
        if mapped:
            return mapped
    if plan:
        p = str(plan).lower().strip()
        if p in CHECKOUT_PLAN_TYPES:
            return p
    return None


def _handle_subscription_event(db: Session, event: stripe.Event) -> None:
    data = event["data"]["object"]
    stripe_subscription_id = data["id"]
    status = (data.get("status") or "").lower()
    current_period_start = data.get("current_period_start")
    current_period_end = data.get("current_period_end")

    metadata = data.get("metadata") or {}
    user_id = metadata.get("user_id")
    plan_type = _resolve_plan_from_subscription_payload(data)

    subscription: Optional[Subscription] = (
        db.query(Subscription)
        .filter(Subscription.stripe_subscription_id == stripe_subscription_id)
        .first()
    )

    if subscription is None and user_id:
        subscription = Subscription(
            user_id=int(user_id),
            plan_type=plan_type or "pro",
            stripe_subscription_id=stripe_subscription_id,
            status=status,
        )
        db.add(subscription)
    elif subscription is not None:
        subscription.status = status
        if plan_type:
            subscription.plan_type = plan_type

    if subscription is None:
        return

    if current_period_start:
        subscription.current_period_start = datetime.fromtimestamp(
            int(current_period_start), tz=timezone.utc
        )
    if current_period_end:
        subscription.current_period_end = datetime.fromtimestamp(
            int(current_period_end), tz=timezone.utc
        )

    trial_end = data.get("trial_end")
    user = db.get(User, subscription.user_id)
    if user:
        user.subscription_status = status
        if trial_end:
            user.trial_end = datetime.fromtimestamp(
                int(trial_end), tz=timezone.utc
            )
        if status in ("canceled", "unpaid", "incomplete_expired"):
            user.plan_type = "free"
            user.trial_end = None
        elif plan_type and status in ("active", "trialing", "past_due"):
            user.plan_type = plan_type
        db.add(user)

    db.add(subscription)
    db.commit()
