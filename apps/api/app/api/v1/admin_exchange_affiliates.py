from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import ExchangeAffiliateLink, User

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _require_admin(current_user: User) -> User:
    if (current_user.role or "").lower() != "admin":
        raise HTTPException(403, "Admin only")
    return current_user


class AffiliateUpsertBody(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=128)
    venue_type: str = Field(default="cex", max_length=16)
    url_template: str | None = Field(
        default=None,
        description="When empty/null, the website uses its default deep link. Use {slug}, {symbol}, {base} in URLs.",
    )
    is_active: bool = True
    notes: str | None = Field(default=None, max_length=512)


class AffiliateCreateBody(AffiliateUpsertBody):
    provider_key: str = Field(..., min_length=1, max_length=64)


def _serialize(r: ExchangeAffiliateLink) -> dict[str, Any]:
    return {
        "id": r.id,
        "provider_key": r.provider_key,
        "venue_type": r.venue_type,
        "display_name": r.display_name,
        "url_template": r.url_template,
        "is_active": r.is_active,
        "notes": r.notes,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


@router.get("/exchange-affiliate-links")
def admin_list_exchange_affiliate_links(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _require_admin(current_user)
    rows = db.query(ExchangeAffiliateLink).order_by(ExchangeAffiliateLink.provider_key).all()
    return {"items": [_serialize(r) for r in rows]}


@router.post("/exchange-affiliate-links")
def admin_create_exchange_affiliate_link(
    body: AffiliateCreateBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _require_admin(current_user)
    key = body.provider_key.strip().lower().replace("-", "_")
    if not re.match(r"^[a-z0-9_]+$", key):
        raise HTTPException(400, "provider_key must be lowercase letters, numbers, underscores")
    exists = db.query(ExchangeAffiliateLink).filter(ExchangeAffiliateLink.provider_key == key).first()
    if exists:
        raise HTTPException(409, "provider_key already exists; use PUT to update")
    row = ExchangeAffiliateLink(
        provider_key=key,
        venue_type=(body.venue_type or "cex").strip().lower()[:16],
        display_name=body.display_name.strip(),
        url_template=(body.url_template.strip() if body.url_template else None) or None,
        is_active=body.is_active,
        notes=(body.notes.strip() if body.notes else None) or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.put("/exchange-affiliate-links/{provider_key}")
def admin_upsert_exchange_affiliate_link(
    provider_key: str,
    body: AffiliateUpsertBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    _require_admin(current_user)
    key = provider_key.strip().lower()
    row = db.query(ExchangeAffiliateLink).filter(ExchangeAffiliateLink.provider_key == key).first()
    if row is None:
        row = ExchangeAffiliateLink(provider_key=key, display_name=body.display_name.strip())
        db.add(row)
    row.display_name = body.display_name.strip()
    row.venue_type = (body.venue_type or "cex").strip().lower()[:16]
    ut = (body.url_template.strip() if body.url_template else None) or None
    row.url_template = ut
    row.is_active = body.is_active
    row.notes = (body.notes.strip() if body.notes else None) or None
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.delete("/exchange-affiliate-links/{provider_key}")
def admin_delete_exchange_affiliate_link(
    provider_key: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    _require_admin(current_user)
    key = provider_key.strip().lower()
    row = db.query(ExchangeAffiliateLink).filter(ExchangeAffiliateLink.provider_key == key).first()
    if row is None:
        raise HTTPException(404, "Not found")
    db.delete(row)
    db.commit()
    return {"status": "deleted", "provider_key": key}
