from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from starlette.responses import Response

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import UplandSavedSearch, User
from app.services.upland.entitlements import (
    has_upland_feature,
    resolve_upland_limits,
    tier_for_user,
)

router = APIRouter(prefix="/api/v1/upland/saved-searches", tags=["upland"])


class SavedSearchIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    filters: dict = Field(default_factory=dict)
    alert_channel: str = Field(default="none", pattern="^(none|email)$")


class SavedSearchOut(BaseModel):
    id: int
    name: str
    filters: dict
    alert_channel: str
    created_at: str
    updated_at: str


def _to_out(row: UplandSavedSearch) -> SavedSearchOut:
    return SavedSearchOut(
        id=row.id,
        name=row.name,
        filters=row.filters or {},
        alert_channel=row.alert_channel,
        created_at=row.created_at.isoformat(),
        updated_at=row.updated_at.isoformat(),
    )


def _require_saved_searches(db: Session, user: User) -> str:
    tier = tier_for_user(db, user)
    if not has_upland_feature(tier, "upland_saved_searches"):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Saved searches require Upland Pro or Elite.",
        )
    return tier


@router.get("", response_model=list[SavedSearchOut])
def list_saved_searches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SavedSearchOut]:
    _require_saved_searches(db, current_user)
    rows = (
        db.query(UplandSavedSearch)
        .filter(UplandSavedSearch.user_id == current_user.id)
        .order_by(UplandSavedSearch.created_at.desc())
        .all()
    )
    return [_to_out(r) for r in rows]


@router.post("", response_model=SavedSearchOut, status_code=status.HTTP_201_CREATED)
def create_saved_search(
    payload: SavedSearchIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedSearchOut:
    tier = _require_saved_searches(db, current_user)
    limits = resolve_upland_limits(tier)
    max_allowed = int(limits.get("savedSearchesMax") or 0)

    existing = (
        db.query(UplandSavedSearch)
        .filter(UplandSavedSearch.user_id == current_user.id)
        .count()
    )
    if max_allowed and existing >= max_allowed:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Saved search limit reached ({max_allowed}). Upgrade your tier.",
        )

    if payload.alert_channel != "none" and tier != "elite":
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Real-time alert channel requires Upland Elite.",
        )

    row = UplandSavedSearch(
        user_id=current_user.id,
        name=payload.name.strip(),
        filters=payload.filters,
        alert_channel=payload.alert_channel,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.delete("/{saved_search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_search(
    saved_search_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    _require_saved_searches(db, current_user)
    row: Optional[UplandSavedSearch] = (
        db.query(UplandSavedSearch)
        .filter(
            UplandSavedSearch.id == saved_search_id,
            UplandSavedSearch.user_id == current_user.id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    db.delete(row)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
