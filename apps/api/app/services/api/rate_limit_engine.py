"""
Rate limiting by API plan.
Free: 100 requests/day
Pro: 10,000 requests/day
Enterprise: unlimited
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import ApiKey, ApiUsage

RATE_LIMITS: dict[str, int] = {
    "free": 100,
    "developer": 1000,
    "pro": 10_000,
    "elite": 50_000,
    "enterprise": 0,
}

# 0 means unlimited
UNLIMITED = 0


def _day_start(utc_now: datetime | None = None) -> datetime:
    now = utc_now or datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def get_usage_today(db: Session, api_key_id: int) -> int:
    """Return total request_count for this API key since start of day (UTC)."""
    day_start = _day_start()
    row = (
        db.query(func.coalesce(func.sum(ApiUsage.request_count), 0))
        .filter(
            ApiUsage.api_key_id == api_key_id,
            ApiUsage.timestamp >= day_start,
        )
        .scalar()
    )
    return int(row or 0)


def check_rate_limit(db: Session, api_key: ApiKey) -> tuple[bool, int, int]:
    """
    Check if the API key is within its rate limit.
    Returns (allowed, current_usage, limit).
    limit is 0 for unlimited.
    """
    limit = api_key.rate_limit or RATE_LIMITS.get(api_key.plan_type, 100)
    if limit == UNLIMITED:
        return True, 0, 0

    usage = get_usage_today(db, api_key.id)
    return usage < limit, usage, limit


def record_usage(
    db: Session,
    api_key_id: int,
    endpoint: str,
    *,
    status_code: int = 200,
) -> None:
    """Record one request for rate limiting and analytics."""
    usage = ApiUsage(
        api_key_id=api_key_id,
        endpoint=endpoint,
        request_count=1,
        http_status=status_code,
    )
    db.add(usage)
    db.flush()
