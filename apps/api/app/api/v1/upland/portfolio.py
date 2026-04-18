from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import UplandPortfolioWatch, User
from app.services.upland.entitlements import has_upland_feature, tier_for_user

router = APIRouter(prefix="/api/v1/upland/portfolio", tags=["upland"])


class WatchIn(BaseModel):
    owner_wallet: str = Field(..., min_length=1, max_length=128)
    label: str = Field(default="", max_length=128)


class WatchOut(BaseModel):
    id: int
    owner_wallet: str
    label: str
    created_at: str


def _require_portfolio(db: Session, user: User) -> None:
    tier = tier_for_user(db, user)
    if not has_upland_feature(tier, "upland_portfolio_tracking"):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Portfolio tracking requires Upland Elite.",
        )


@router.get("", response_model=list[WatchOut])
def list_watches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WatchOut]:
    _require_portfolio(db, current_user)
    rows = (
        db.query(UplandPortfolioWatch)
        .filter(UplandPortfolioWatch.user_id == current_user.id)
        .order_by(UplandPortfolioWatch.created_at.desc())
        .all()
    )
    return [
        WatchOut(
            id=r.id,
            owner_wallet=r.owner_wallet,
            label=r.label or "",
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


@router.post("", response_model=WatchOut, status_code=status.HTTP_201_CREATED)
def create_watch(
    payload: WatchIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WatchOut:
    _require_portfolio(db, current_user)
    row = UplandPortfolioWatch(
        user_id=current_user.id,
        owner_wallet=payload.owner_wallet.strip(),
        label=payload.label.strip(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return WatchOut(
        id=row.id,
        owner_wallet=row.owner_wallet,
        label=row.label,
        created_at=row.created_at.isoformat(),
    )


@router.delete("/{watch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_watch(
    watch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    _require_portfolio(db, current_user)
    row: Optional[UplandPortfolioWatch] = (
        db.query(UplandPortfolioWatch)
        .filter(
            UplandPortfolioWatch.id == watch_id,
            UplandPortfolioWatch.user_id == current_user.id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    db.delete(row)
    db.commit()
    return None
