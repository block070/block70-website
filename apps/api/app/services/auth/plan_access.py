from __future__ import annotations

from fastapi import Depends, HTTPException, status

from app.core.auth_middleware import get_current_user
from app.models import User


def _ensure_min_plan(user: User, minimum: str) -> None:
    order = {"free": 0, "pro": 1, "elite": 2}
    user_level = order.get(user.plan_type, 0)
    required_level = order.get(minimum, 1)
    if user_level < required_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{minimum.capitalize()} plan required",
        )


def require_pro(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency for endpoints that require Pro or Elite.
    """
    _ensure_min_plan(current_user, "pro")
    return current_user


def require_elite(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency for endpoints that require Elite.
    """
    _ensure_min_plan(current_user, "elite")
    return current_user

