"""
Admin growth analytics: new users, DAU, engagement.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import User, UserActivity, UserNotification, Referral, SignalBot, BotSignalEvent, BotAnalytics

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _require_admin(current_user: User) -> User:
    if (current_user.role or "").lower() != "admin":
        raise HTTPException(403, "Admin only")
    return current_user


@router.get("/analytics")
def get_growth_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Growth dashboard: new users, DAU, engagement. Admin only."""
    _require_admin(current_user)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_users = db.query(func.count(User.id)).scalar() or 0
    new_users_7d = (
        db.query(func.count(User.id))
        .filter(User.created_at >= now - timedelta(days=7))
        .scalar() or 0
    )
    new_users_30d = (
        db.query(func.count(User.id))
        .filter(User.created_at >= now - timedelta(days=30))
        .scalar() or 0
    )

    dau = (
        db.query(func.count(func.distinct(UserActivity.user_id)))
        .filter(UserActivity.timestamp >= today_start)
        .scalar() or 0
    )

    notifications_7d = (
        db.query(func.count(UserNotification.id))
        .filter(UserNotification.created_at >= now - timedelta(days=7))
        .scalar() or 0
    )

    referrals_7d = (
        db.query(func.count(Referral.id))
        .filter(Referral.created_at >= now - timedelta(days=7))
        .scalar() or 0
    )

    return {
        "total_users": total_users,
        "new_users_7d": new_users_7d,
        "new_users_30d": new_users_30d,
        "dau": dau,
        "notifications_7d": notifications_7d,
        "referrals_7d": referrals_7d,
    }


@router.get("/bots")
def get_bots_performance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Bot performance dashboard: signals sent, engagement. Admin only."""
    _require_admin(current_user)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    since_7d = now - timedelta(days=7)

    bots = db.query(SignalBot).all()
    out = []
    for bot in bots:
        sent_24h = (
            db.query(func.count(BotSignalEvent.id))
            .filter(BotSignalEvent.bot_id == bot.id, BotSignalEvent.sent_at >= today_start)
            .scalar() or 0
        )
        sent_7d = (
            db.query(func.count(BotSignalEvent.id))
            .filter(BotSignalEvent.bot_id == bot.id, BotSignalEvent.sent_at >= since_7d)
            .scalar() or 0
        )
        clicks_7d = (
            db.query(func.coalesce(func.sum(BotAnalytics.clicks), 0))
            .filter(BotAnalytics.bot_id == bot.id, BotAnalytics.timestamp >= since_7d)
            .scalar() or 0
        )
        out.append({
            "bot_id": bot.id,
            "platform": bot.platform,
            "channel_id": bot.channel_id,
            "is_active": bot.is_active,
            "signals_sent_24h": sent_24h,
            "signals_sent_7d": sent_7d,
            "clicks_7d": int(clicks_7d),
        })
    return {"bots": out}
