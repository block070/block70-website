"""
Notification engine: trigger notifications for new signals, alpha posts, strategy alerts.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import UserNotification


class NotificationType:
    NEW_SIGNAL = "new_signal"
    ALPHA_POST = "alpha_post"
    STRATEGY_ALERT = "strategy_alert"
    REFERRAL_REWARD = "referral_reward"
    CREATOR_REWARD = "creator_reward"
    AI_INSIGHT = "ai_insight"
    NARRATIVE_SHIFT = "narrative_shift"


def notify_user(
    db: Session,
    user_id: int,
    notification_type: str,
    content: str,
) -> UserNotification:
    """Create a user notification. Call after signals, alpha posts, or strategy events."""
    n = UserNotification(
        user_id=user_id,
        notification_type=notification_type,
        content=content,
    )
    db.add(n)
    db.flush()
    return n


def notify_new_signal(db: Session, user_id: int, token_symbol: str, signal_type: str) -> UserNotification:
    return notify_user(
        db,
        user_id,
        NotificationType.NEW_SIGNAL,
        f"New signal: {signal_type} for {token_symbol}",
    )


def notify_alpha_post(db: Session, user_id: int, post_title: str, author_name: str) -> UserNotification:
    return notify_user(
        db,
        user_id,
        NotificationType.ALPHA_POST,
        f"New alpha from {author_name}: {post_title}",
    )


def notify_strategy_alert(db: Session, user_id: int, strategy_name: str, message: str) -> UserNotification:
    return notify_user(
        db,
        user_id,
        NotificationType.STRATEGY_ALERT,
        f"Strategy «{strategy_name}»: {message}",
    )


def notify_ai_insight(
    db: Session,
    user_id: int,
    title: str,
    confidence_score: float,
    insight_type: str,
) -> UserNotification:
    """Notify when a high-confidence AI insight is generated."""
    return notify_user(
        db,
        user_id,
        NotificationType.AI_INSIGHT,
        f"AI Insight ({confidence_score:.0%}): {title} [{insight_type}]",
    )


def notify_narrative_shift(
    db: Session,
    user_id: int,
    narrative_name: str,
    trend_score: float,
) -> UserNotification:
    """Notify when a major narrative shift is detected."""
    return notify_user(
        db,
        user_id,
        NotificationType.NARRATIVE_SHIFT,
        f"Narrative shift: {narrative_name} (trend {trend_score:.0%})",
    )
