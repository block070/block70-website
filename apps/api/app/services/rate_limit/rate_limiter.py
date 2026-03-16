from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import UsageMetric, User


PLAN_LIMITS = {
    "free": 100,
    "pro": 1000,
    "elite": None,  # unlimited
}


def _get_limit_for_user(user: User) -> int | None:
    return PLAN_LIMITS.get(user.plan_type, PLAN_LIMITS["free"])


def rate_limit_dependency(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """
    FastAPI dependency to enforce per-user daily API call limits.
    """
    limit = _get_limit_for_user(current_user)
    if limit is None:
        # Unlimited
        _record_usage(db, current_user.id, "api_calls", 1)
        return

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=1)

    used = (
        db.query(UsageMetric)
        .filter(
            UsageMetric.user_id == current_user.id,
            UsageMetric.metric_type == "api_calls",
            UsageMetric.timestamp >= since,
        )
        .with_entities(UsageMetric.metric_value)
        .all()
    )

    total_used = sum(row[0] for row in used)
    if total_used >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily API limit exceeded for your plan",
        )

    _record_usage(db, current_user.id, "api_calls", 1)


def _record_usage(
    db: Session,
    user_id: int,
    metric_type: str,
    metric_value: int,
) -> None:
    metric = UsageMetric(
        user_id=user_id,
        metric_type=metric_type,
        metric_value=metric_value,
    )
    db.add(metric)
    db.commit()

