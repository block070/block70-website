from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user, get_current_user_optional
from app.db import get_db
from app.models import User
from app.services.upland.entitlements import (
    feature_matrix_version,
    features_for_tier,
    resolve_upland_limits,
    tier_for_user,
)

router = APIRouter(prefix="/api/v1/upland", tags=["upland"])


@router.get("/entitlements")
def get_entitlements(
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
) -> dict:
    """Return the effective Upland tier, features, and usage limits.

    Works anonymously (returns the free-tier entitlement) so the Next.js
    middleware + server components can call this without a user session.
    """
    if current_user is None:
        tier = "free"
        user_id = None
    else:
        tier = tier_for_user(db, current_user)
        user_id = current_user.id

    return {
        "tier": tier,
        "features": features_for_tier(tier),
        "limits": resolve_upland_limits(tier),
        "matrix_version": feature_matrix_version(),
        "user_id": user_id,
    }


@router.get("/feature-matrix")
def get_feature_matrix(
    _current_user: User = Depends(get_current_user),
) -> dict:
    """Admin/dev endpoint: return the raw feature matrix for parity tests."""
    from app.services.upland.entitlements import UPLAND_FEATURE_MATRIX

    return UPLAND_FEATURE_MATRIX
