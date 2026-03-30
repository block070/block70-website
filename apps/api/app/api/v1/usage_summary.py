from __future__ import annotations

import calendar
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import AISearchQuery, ApiKey, ApiUsage, Subscription, UsageMetric, User
from app.services.api.rate_limit_engine import RATE_LIMITS, UNLIMITED, get_usage_today
from app.services.rate_limit.rate_limiter import PLAN_LIMITS
from app.services.usage.plan_display import (
    AI_DAILY_LIMITS,
    AI_MONTHLY_LIMITS,
    ESTIMATED_MONTHLY_USD,
    SIGNALS_MONTHLY_LIMITS,
)

router = APIRouter(prefix="/api/v1/usage", tags=["usage"])


def _subscription_row(db: Session, user_id: int) -> Subscription | None:
    return (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id)
        .order_by(Subscription.created_at.desc())
        .first()
    )


def _resolve_billing_period(
    sub: Subscription | None,
) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    if (
        sub
        and sub.current_period_start
        and sub.current_period_end
    ):
        return sub.current_period_start, sub.current_period_end
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_day = calendar.monthrange(now.year, now.month)[1]
    end = now.replace(
        day=last_day,
        hour=23,
        minute=59,
        second=59,
        microsecond=999999,
    )
    return start, end


def _effective_plan_type(user: User, sub: Subscription | None) -> str:
    if sub and getattr(sub, "plan_type", None):
        return sub.plan_type
    return user.plan_type


def _upgrade_target(plan_type: str) -> str | None:
    if plan_type == "free":
        return "pro"
    if plan_type == "pro":
        return "elite"
    if plan_type == "elite":
        return "quant"
    return None


def _monthly_remaining_display(used: int, limit: int | None) -> dict:
    if limit is None:
        return {"limit": None, "remaining": None, "unlimited": True}
    remaining = max(0, limit - used)
    return {"limit": limit, "remaining": remaining, "unlimited": False}


@router.get("/summary")
def get_usage_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    sub = _subscription_row(db, current_user.id)
    period_start, period_end = _resolve_billing_period(sub)
    plan_type = _effective_plan_type(current_user, sub)
    status = sub.status if sub else "none"

    keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    key_ids = [k.id for k in keys]

    api_calls = 0
    if key_ids:
        api_calls = int(
            db.query(func.coalesce(func.sum(ApiUsage.request_count), 0))
            .filter(
                ApiUsage.api_key_id.in_(key_ids),
                ApiUsage.timestamp >= period_start,
                ApiUsage.timestamp <= period_end,
            )
            .scalar()
            or 0,
        )

    signals_used = int(
        db.query(func.coalesce(func.sum(UsageMetric.metric_value), 0))
        .filter(
            UsageMetric.user_id == current_user.id,
            UsageMetric.metric_type == "signals_used",
            UsageMetric.timestamp >= period_start,
            UsageMetric.timestamp <= period_end,
        )
        .scalar()
        or 0,
    )

    ai_queries = int(
        db.query(func.count(AISearchQuery.id))
        .filter(
            AISearchQuery.user_id == current_user.id,
            AISearchQuery.created_at >= period_start,
            AISearchQuery.created_at <= period_end,
        )
        .scalar()
        or 0,
    )

    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(days=1)
    premium_api_calls_24h = int(
        db.query(func.coalesce(func.sum(UsageMetric.metric_value), 0))
        .filter(
            UsageMetric.user_id == current_user.id,
            UsageMetric.metric_type == "api_calls",
            UsageMetric.timestamp >= since_24h,
        )
        .scalar()
        or 0,
    )
    premium_api_limit_24h = PLAN_LIMITS.get(plan_type, PLAN_LIMITS["free"])

    developer_keys = []
    for k in keys:
        lim = k.rate_limit or RATE_LIMITS.get(k.plan_type, 100)
        used_today = get_usage_today(db, k.id)
        if lim == UNLIMITED:
            developer_keys.append(
                {
                    "api_key_id": k.id,
                    "key_prefix": k.key_prefix,
                    "key_label": k.key_label,
                    "plan_type": k.plan_type,
                    "usage_today": used_today,
                    "daily_limit": None,
                    "remaining_today": None,
                    "unlimited": True,
                },
            )
        else:
            developer_keys.append(
                {
                    "api_key_id": k.id,
                    "key_prefix": k.key_prefix,
                    "key_label": k.key_label,
                    "plan_type": k.plan_type,
                    "usage_today": used_today,
                    "daily_limit": lim,
                    "remaining_today": max(0, lim - used_today),
                    "unlimited": False,
                },
            )

    ai_limit = AI_MONTHLY_LIMITS.get(plan_type, AI_MONTHLY_LIMITS["free"])
    ai_daily_limit = AI_DAILY_LIMITS.get(plan_type, AI_DAILY_LIMITS["free"])
    signals_limit = SIGNALS_MONTHLY_LIMITS.get(
        plan_type,
        SIGNALS_MONTHLY_LIMITS["free"],
    )

    estimated = ESTIMATED_MONTHLY_USD.get(plan_type, 0)

    return {
        "period": {
            "start": period_start.isoformat(),
            "end": period_end.isoformat(),
        },
        "plan": {
            "type": plan_type,
            "status": status,
            "current_period_end": sub.current_period_end.isoformat()
            if sub and sub.current_period_end
            else None,
        },
        "metrics": {
            "api_calls": api_calls,
            "signals_used": signals_used,
            "ai_queries": ai_queries,
            "ai_queries_24h": ai_queries_24h,
        },
        "limits_display": {
            "ai": _monthly_remaining_display(ai_queries, ai_limit),
            "ai_daily": _monthly_remaining_display(ai_queries_24h, ai_daily_limit),
            "signals": _monthly_remaining_display(signals_used, signals_limit),
        },
        "quotas": {
            "developer_keys": developer_keys,
            "premium_api_calls_24h": premium_api_calls_24h,
            "premium_api_limit_24h": premium_api_limit_24h,
        },
        "billing": {
            "estimated_monthly_usd": estimated,
            "currency": "USD",
            "note": "List price estimate; open billing portal for actual charges.",
        },
        "actions": {
            "upgrade_plan": _upgrade_target(plan_type),
            "pricing_path": "/pricing",
            "portal_return_path": "/usage",
        },
    }
