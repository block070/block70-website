from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.core.plan_access import effective_plan, has_access, has_feature
from app.db import get_db
from app.models import Subscription, User


def _latest_subscription(db: Session, user_id: int) -> Subscription | None:
    return (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id)
        .order_by(Subscription.created_at.desc())
        .first()
    )


def resolve_effective_plan(db: Session, user: User | None) -> str:
    if user is None:
        return "free"
    sub = _latest_subscription(db, user.id)
    return effective_plan(user, sub)


def _ensure_min_plan(db: Session, user: User, minimum: str) -> None:
    eff = resolve_effective_plan(db, user)
    if not has_access(eff, minimum):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{minimum.capitalize()} plan or higher required",
        )


def require_pro(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    _ensure_min_plan(db, current_user, "pro")
    return current_user


def require_elite(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    _ensure_min_plan(db, current_user, "elite")
    return current_user


def require_quant(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    _ensure_min_plan(db, current_user, "quant")
    return current_user


def require_plan(minimum: str) -> Callable[..., User]:
    def _dep(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        _ensure_min_plan(db, current_user, minimum)
        return current_user

    return _dep


def require_feature(feature: str) -> Callable[..., User]:
    def _dep(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        eff = resolve_effective_plan(db, current_user)
        if not has_feature(eff, feature):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This action requires a higher plan tier",
            )
        return current_user

    return _dep
