from __future__ import annotations

import hashlib
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import UplandApiKey, User
from app.services.upland.entitlements import has_upland_feature, tier_for_user

router = APIRouter(prefix="/api/v1/upland/api-keys", tags=["upland"])

_KEY_PREFIX = "upland_live_"


class ApiKeyIn(BaseModel):
    label: str = Field(..., min_length=1, max_length=128)


class ApiKeyOut(BaseModel):
    id: int
    label: str
    key_prefix: str
    created_at: str
    revoked: bool


class ApiKeyCreateOut(ApiKeyOut):
    plaintext_key: str = Field(
        ..., description="Shown once at creation. Store securely."
    )


def _require_api_access(db: Session, user: User) -> None:
    tier = tier_for_user(db, user)
    if not has_upland_feature(tier, "upland_api_access"):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="API access requires Upland Elite.",
        )


def _hash_key(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


@router.get("", response_model=list[ApiKeyOut])
def list_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ApiKeyOut]:
    _require_api_access(db, current_user)
    rows = (
        db.query(UplandApiKey)
        .filter(UplandApiKey.user_id == current_user.id)
        .order_by(UplandApiKey.created_at.desc())
        .all()
    )
    return [
        ApiKeyOut(
            id=r.id,
            label=r.label,
            key_prefix=r.key_prefix,
            created_at=r.created_at.isoformat(),
            revoked=r.revoked,
        )
        for r in rows
    ]


@router.post("", response_model=ApiKeyCreateOut, status_code=status.HTTP_201_CREATED)
def create_key(
    payload: ApiKeyIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiKeyCreateOut:
    _require_api_access(db, current_user)
    random_part = secrets.token_urlsafe(32)
    plaintext = f"{_KEY_PREFIX}{random_part}"
    prefix_tag = plaintext[: len(_KEY_PREFIX) + 6]

    row = UplandApiKey(
        user_id=current_user.id,
        label=payload.label.strip(),
        key_hash=_hash_key(plaintext),
        key_prefix=prefix_tag,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return ApiKeyCreateOut(
        id=row.id,
        label=row.label,
        key_prefix=row.key_prefix,
        created_at=row.created_at.isoformat(),
        revoked=row.revoked,
        plaintext_key=plaintext,
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    _require_api_access(db, current_user)
    row: Optional[UplandApiKey] = (
        db.query(UplandApiKey)
        .filter(
            UplandApiKey.id == key_id,
            UplandApiKey.user_id == current_user.id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    row.revoked = True
    from datetime import datetime, timezone

    row.revoked_at = datetime.now(timezone.utc)
    db.add(row)
    db.commit()
    return None
