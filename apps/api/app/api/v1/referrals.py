"""
Referral program API: code, link, dashboard.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import User, Referral, CreatorReward
from app.services.referral_service import ensure_user_referral_code, get_referral_link

router = APIRouter(prefix="/api/v1/referrals", tags=["referrals"])


@router.get("/me")
def get_my_referral(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    base_url: str | None = Query(None, description="Override signup base URL for referral link"),
) -> dict:
    """Get current user's referral code and shareable link."""
    code = ensure_user_referral_code(db, current_user)
    db.commit()
    link = get_referral_link(db, current_user, base_url=base_url)
    return {
        "referral_code": code,
        "referral_link": link,
    }


@router.get("/dashboard")
def get_referral_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    base_url: str | None = Query(None, description="Override signup base URL"),
) -> dict:
    """Referral count, rewards earned, and referral link."""
    code = ensure_user_referral_code(db, current_user)
    db.commit()
    link = get_referral_link(db, current_user, base_url=base_url)

    referral_count = (
        db.query(func.count(Referral.id))
        .filter(Referral.referrer_user_id == current_user.id)
        .scalar() or 0
    )

    rewards_earned = (
        db.query(func.coalesce(func.sum(CreatorReward.reward_amount), 0.0))
        .filter(
            CreatorReward.user_id == current_user.id,
            CreatorReward.reward_type.in_(["referral_reward", "referral_bonus"]),
        )
        .scalar() or 0.0
    )

    return {
        "referral_code": code,
        "referral_link": link,
        "referral_count": referral_count,
        "rewards_earned": float(rewards_earned),
    }
