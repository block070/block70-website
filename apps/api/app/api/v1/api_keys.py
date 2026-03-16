"""
API key management: create, list, revoke. Requires JWT auth.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import ApiKey, ApiUsage, User
from app.services.api.api_key_generator import generate_api_key
from app.services.api.rate_limit_engine import RATE_LIMITS, get_usage_today

router = APIRouter(prefix="/api/v1/api-keys", tags=["api-keys"])


@router.post("/create")
def create_key(
    plan_type: str = "free",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Create a new API key. Returns the raw key once; store it securely.
    plan_type: free, developer, pro, elite, enterprise.
    """
    rate_limit = RATE_LIMITS.get(plan_type, 100)
    api_key, raw_key = generate_api_key(
        db, current_user.id, plan_type=plan_type, rate_limit=rate_limit
    )
    db.commit()
    db.refresh(api_key)
    return {
        "id": api_key.id,
        "key_prefix": api_key.key_prefix,
        "raw_key": raw_key,
        "plan_type": api_key.plan_type,
        "rate_limit": api_key.rate_limit,
        "created_at": (api_key.created_at or datetime.now(timezone.utc)).isoformat(),
        "message": "Store the raw_key securely; it will not be shown again.",
    }


@router.get("/list")
def list_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """List current user's API keys (no raw keys)."""
    rows = (
        db.query(ApiKey)
        .filter(ApiKey.user_id == current_user.id)
        .order_by(ApiKey.created_at.desc())
        .all()
    )
    return [
        {
            "id": k.id,
            "key_prefix": k.key_prefix,
            "plan_type": k.plan_type,
            "rate_limit": k.rate_limit,
            "is_active": k.is_active,
            "created_at": (k.created_at or datetime.now(timezone.utc)).isoformat(),
            "last_used": (k.last_used or datetime.now(timezone.utc)).isoformat() if k.last_used else None,
            "usage_today": get_usage_today(db, k.id),
        }
        for k in rows
    ]


@router.post("/{key_id}/revoke")
def revoke_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Revoke an API key (set is_active=False)."""
    api_key = (
        db.query(ApiKey)
        .filter(ApiKey.id == key_id, ApiKey.user_id == current_user.id)
        .first()
    )
    if not api_key:
        raise HTTPException(404, "API key not found")
    api_key.is_active = False
    db.add(api_key)
    db.commit()
    return {"status": "revoked", "id": key_id}


@router.get("/analytics")
def get_usage_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = Query(7, ge=1, le=90),
) -> dict:
    """API usage analytics: request counts by key and by endpoint."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    key_ids = [k.id for k in keys]

    by_key = []
    for k in keys:
        total = (
            db.query(func.coalesce(func.sum(ApiUsage.request_count), 0))
            .filter(ApiUsage.api_key_id == k.id, ApiUsage.timestamp >= since)
            .scalar() or 0
        )
        by_key.append({
            "api_key_id": k.id,
            "key_prefix": k.key_prefix,
            "plan_type": k.plan_type,
            "request_count": int(total),
            "usage_today": get_usage_today(db, k.id),
        })

    by_endpoint = (
        db.query(ApiUsage.endpoint, func.sum(ApiUsage.request_count).label("total"))
        .filter(ApiUsage.api_key_id.in_(key_ids), ApiUsage.timestamp >= since)
        .group_by(ApiUsage.endpoint)
        .order_by(func.sum(ApiUsage.request_count).desc())
        .all()
    )
    return {
        "period_days": days,
        "by_key": by_key,
        "by_endpoint": [{"endpoint": e, "request_count": int(t)} for e, t in by_endpoint],
    }
