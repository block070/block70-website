"""
API key management: create, list, update, revoke, analytics. Requires JWT auth.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import ApiKey, ApiUsage, User
from app.services.api.api_key_generator import generate_api_key
from app.services.api.api_key_policies import DEFAULT_SCOPES
from app.services.api.rate_limit_engine import RATE_LIMITS, get_usage_today

router = APIRouter(prefix="/api/v1/api-keys", tags=["api-keys"])


class ApiScopes(BaseModel):
    read: bool = True
    write: bool = False
    trading: bool = False


class ApiKeyCreateBody(BaseModel):
    plan_type: str = Field(default="free")
    label: str | None = Field(None, max_length=128)
    scopes: ApiScopes | None = None
    ip_allowlist: list[str] | None = Field(
        None,
        description="Allowed client IPs or CIDRs; empty or omit = any IP",
    )


class ApiKeyUpdateBody(BaseModel):
    label: str | None = Field(None, max_length=128)
    scopes: ApiScopes | None = None
    ip_allowlist: list[str] | None = None
    rate_limit: int | None = Field(None, ge=0, le=10_000_000)


def _scopes_to_json(s: ApiScopes | None) -> dict | None:
    if s is None:
        return None
    return {"read": s.read, "write": s.write, "trading": s.trading}


def _key_to_dict(db: Session, k: ApiKey) -> dict:
    scopes = k.scopes if isinstance(k.scopes, dict) else None
    if scopes is None:
        eff = {"read": True, "write": True, "trading": True}
    else:
        eff = {**DEFAULT_SCOPES}
        for x in ("read", "write", "trading"):
            if x in scopes:
                eff[x] = bool(scopes[x])
    return {
        "id": k.id,
        "key_prefix": k.key_prefix,
        "key_label": k.key_label,
        "plan_type": k.plan_type,
        "rate_limit": k.rate_limit,
        "scopes": eff,
        "ip_allowlist": k.ip_allowlist if isinstance(k.ip_allowlist, list) else [],
        "is_active": k.is_active,
        "created_at": (k.created_at or datetime.now(timezone.utc)).isoformat(),
        "last_used": k.last_used.isoformat() if k.last_used else None,
        "usage_today": get_usage_today(db, k.id),
    }


@router.post("/create")
def create_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    body: ApiKeyCreateBody | None = Body(default=None),
    plan_type: str | None = Query(None, description="Deprecated: use JSON body"),
) -> dict:
    """
    Create a new API key. Returns the raw key once; store it securely.
    """
    payload = body or ApiKeyCreateBody()
    pt = plan_type or payload.plan_type
    rate_limit = RATE_LIMITS.get(pt, 100)
    scopes_dict = _scopes_to_json(payload.scopes)
    api_key, raw_key = generate_api_key(
        db,
        current_user.id,
        plan_type=pt,
        rate_limit=rate_limit,
        key_label=payload.label,
        scopes=scopes_dict,
        ip_allowlist=payload.ip_allowlist,
    )
    db.commit()
    db.refresh(api_key)
    return {
        "id": api_key.id,
        "key_prefix": api_key.key_prefix,
        "raw_key": raw_key,
        "plan_type": api_key.plan_type,
        "rate_limit": api_key.rate_limit,
        "key_label": api_key.key_label,
        "scopes": _key_to_dict(db, api_key)["scopes"],
        "ip_allowlist": _key_to_dict(db, api_key)["ip_allowlist"],
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
    return [_key_to_dict(db, k) for k in rows]


@router.patch("/{key_id}")
def update_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    body: ApiKeyUpdateBody = Body(...),
) -> dict:
    """Update label, scopes, IP allowlist, or custom rate limit."""
    api_key = (
        db.query(ApiKey)
        .filter(ApiKey.id == key_id, ApiKey.user_id == current_user.id)
        .first()
    )
    if not api_key:
        raise HTTPException(404, "API key not found")
    patch = body.model_dump(exclude_unset=True)
    if "label" in patch:
        v = patch["label"]
        api_key.key_label = (
            str(v).strip()[:128] if v is not None and str(v).strip() else None
        )
    if "scopes" in patch and patch["scopes"] is not None:
        s = patch["scopes"]
        if isinstance(s, dict):
            api_key.scopes = {
                "read": bool(s.get("read", True)),
                "write": bool(s.get("write", False)),
                "trading": bool(s.get("trading", False)),
            }
    if "ip_allowlist" in patch:
        raw = patch["ip_allowlist"]
        api_key.ip_allowlist = raw if isinstance(raw, list) else []
    if "rate_limit" in patch and patch["rate_limit"] is not None:
        api_key.rate_limit = int(patch["rate_limit"])
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    return _key_to_dict(db, api_key)


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
    """API usage: requests, errors, per key, per endpoint, per day."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    key_ids = [k.id for k in keys]

    status_ok = func.coalesce(ApiUsage.http_status, 200)

    by_key = []
    for k in keys:
        total = (
            db.query(func.coalesce(func.sum(ApiUsage.request_count), 0))
            .filter(ApiUsage.api_key_id == k.id, ApiUsage.timestamp >= since)
            .scalar()
            or 0
        )
        err = (
            db.query(func.coalesce(func.sum(ApiUsage.request_count), 0))
            .filter(
                ApiUsage.api_key_id == k.id,
                ApiUsage.timestamp >= since,
                status_ok >= 400,
            )
            .scalar()
            or 0
        )
        by_key.append({
            "api_key_id": k.id,
            "key_prefix": k.key_prefix,
            "key_label": k.key_label,
            "plan_type": k.plan_type,
            "request_count": int(total),
            "error_count": int(err),
            "usage_today": get_usage_today(db, k.id),
        })

    by_endpoint = (
        db.query(ApiUsage.endpoint, func.sum(ApiUsage.request_count).label("total"))
        .filter(ApiUsage.api_key_id.in_(key_ids), ApiUsage.timestamp >= since)
        .group_by(ApiUsage.endpoint)
        .order_by(func.sum(ApiUsage.request_count).desc())
        .limit(50)
        .all()
    )

    err_by_endpoint = (
        db.query(ApiUsage.endpoint, func.sum(ApiUsage.request_count).label("total"))
        .filter(
            ApiUsage.api_key_id.in_(key_ids),
            ApiUsage.timestamp >= since,
            status_ok >= 400,
        )
        .group_by(ApiUsage.endpoint)
        .order_by(func.sum(ApiUsage.request_count).desc())
        .limit(20)
        .all()
    )

    day_bucket = func.date_trunc("day", ApiUsage.timestamp).label("d")
    by_day_rows = (
        db.query(
            day_bucket,
            func.sum(ApiUsage.request_count).label("requests"),
            func.sum(
                case((status_ok >= 400, ApiUsage.request_count), else_=0)
            ).label("errors"),
        )
        .filter(ApiUsage.api_key_id.in_(key_ids), ApiUsage.timestamp >= since)
        .group_by(day_bucket)
        .order_by(day_bucket)
        .all()
    )
    by_day = [
        {
            "date": d.isoformat() if hasattr(d, "isoformat") else str(d),
            "requests": int(r or 0),
            "errors": int(e or 0),
        }
        for d, r, e in by_day_rows
    ]

    total_requests = sum(x["request_count"] for x in by_key)
    total_errors = sum(x["error_count"] for x in by_key)

    return {
        "period_days": days,
        "total_requests": total_requests,
        "total_errors": total_errors,
        "by_key": by_key,
        "by_endpoint": [{"endpoint": ep, "request_count": int(t)} for ep, t in by_endpoint],
        "errors_by_endpoint": [{"endpoint": ep, "request_count": int(t)} for ep, t in err_by_endpoint],
        "by_day": by_day,
    }
