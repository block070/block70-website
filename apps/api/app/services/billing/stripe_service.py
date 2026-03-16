from __future__ import annotations

import json
import os
from typing import Optional

import stripe
from sqlalchemy.orm import Session

from app.models import Subscription, User


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


def _get_price_for_plan(plan_type: str) -> str:
  env_key = {
      "free": "STRIPE_PRICE_FREE",
      "pro": "STRIPE_PRICE_PRO",
      "elite": "STRIPE_PRICE_ELITE",
  }.get(plan_type)
  if not env_key:
    raise ValueError(f"Unsupported plan type: {plan_type}")
  price_id = os.getenv(env_key)
  if not price_id:
    raise RuntimeError(f"{env_key} environment variable is not set")
  return price_id


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

  # Ensure we have a subscription record
  subscription: Optional[Subscription] = (
      db.query(Subscription)
      .filter(Subscription.user_id == user.id)
      .order_by(Subscription.created_at.desc())
      .first()
  )

  if subscription is None:
    subscription = Subscription(
        user_id=user.id,
        plan_type=plan_type,
        status="pending",
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)

  price_id = _get_price_for_plan(plan_type)

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
      metadata={
          "user_id": str(user.id),
          "plan_type": plan_type,
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

  if event["type"] in {
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
  }:
    _handle_subscription_event(db, event)


def _handle_subscription_event(db: Session, event: stripe.Event) -> None:
  data = event["data"]["object"]
  stripe_subscription_id = data["id"]
  status = data["status"]
  current_period_start = data.get("current_period_start")
  current_period_end = data.get("current_period_end")

  metadata = data.get("metadata") or {}
  user_id = metadata.get("user_id")
  plan_type = metadata.get("plan_type")

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
    subscription.plan_type = plan_type or subscription.plan_type

  if subscription is None:
    return

  if current_period_start:
    from datetime import datetime, timezone

    subscription.current_period_start = datetime.fromtimestamp(
        current_period_start, tz=timezone.utc
    )
  if current_period_end:
    from datetime import datetime, timezone

    subscription.current_period_end = datetime.fromtimestamp(
        current_period_end, tz=timezone.utc
    )

  db.add(subscription)

  # Optionally update user's plan_type to match subscription
  user = db.get(User, subscription.user_id)
  if user and plan_type:
    user.plan_type = plan_type
    db.add(user)

  db.commit()

