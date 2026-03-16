"""
Award Blocks when user actions occur: daily login, alpha posts, referrals, signal shares.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import BlockTransaction, RewardAction, UserBlocks

TransactionType = Literal["earn", "spend", "bonus"]

# Default amounts if RewardAction not in DB
DEFAULT_REWARDS: dict[str, float] = {
    "daily_checkin": 5.0,
    "referral_signup": 25.0,
    "referral_active": 50.0,
    "alpha_post": 10.0,
    "alpha_upvotes": 2.0,
    "alpha_accurate": 20.0,
    "strategy_created": 15.0,
    "strategy_performed": 30.0,
    "signal_share": 3.0,
    "streak_3": 10.0,
    "streak_7": 25.0,
    "streak_30": 100.0,
}


def _get_reward_amount(db: Session, action_type: str) -> float:
    row = db.query(RewardAction).filter(RewardAction.action_type == action_type).first()
    if row:
        return float(row.reward_amount)
    return DEFAULT_REWARDS.get(action_type, 0.0)


def get_or_create_user_blocks(db: Session, user_id: int) -> UserBlocks:
    ub = db.query(UserBlocks).filter(UserBlocks.user_id == user_id).first()
    if ub:
        return ub
    ub = UserBlocks(user_id=user_id, balance=0.0)
    db.add(ub)
    db.flush()
    return ub


# Anti-abuse: max same action per hour per user
MAX_ACTION_PER_HOUR: dict[str, int] = {
    "signal_share": 20,
}
# For rate-limit count we match description by prefix
ACTION_DESCRIPTION_PREFIX: dict[str, str] = {
    "signal_share": "Signal shared",
}


def _recent_action_count(db: Session, user_id: int, action_type: str, hours: int = 1) -> int:
    prefix = ACTION_DESCRIPTION_PREFIX.get(action_type, action_type)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    return (
        db.query(func.count(BlockTransaction.id))
        .filter(
            BlockTransaction.user_id == user_id,
            BlockTransaction.created_at >= since,
            BlockTransaction.description.like(f"{prefix}%"),
        )
        .scalar() or 0
    )


def award_blocks(
    db: Session,
    user_id: int,
    action_type: str,
    amount: float | None = None,
    description: str | None = None,
    tx_type: TransactionType = "earn",
) -> tuple[UserBlocks, BlockTransaction]:
    """
    Award blocks to user and record transaction. Returns (UserBlocks, BlockTransaction).
    Use tx_type "bonus" for streak bonuses, "earn" for normal rewards.
    Anti-abuse: caps certain actions per hour (e.g. signal_share).
    """
    ub = get_or_create_user_blocks(db, user_id)
    if amount is None:
        amount = _get_reward_amount(db, action_type)
    if amount <= 0:
        return ub, None  # type: ignore
    cap = MAX_ACTION_PER_HOUR.get(action_type)
    if cap is not None:
        recent = _recent_action_count(db, user_id, action_type, hours=1)
        if recent >= cap:
            return ub, None  # type: ignore  # rate limited
    ub.balance = (ub.balance or 0) + amount
    db.add(ub)
    tx = BlockTransaction(
        user_id=user_id,
        transaction_type=tx_type,
        amount=amount,
        description=description or action_type,
    )
    db.add(tx)
    db.flush()
    return ub, tx


def process_daily_checkin(db: Session, user_id: int) -> tuple[float, int, str]:
    """
    Process daily check-in. Returns (blocks_awarded, new_streak_days, message).
    Enforces once per calendar day (UTC). Applies streak bonuses (3, 7, 30 days).
    """
    today = date.today()
    ub = get_or_create_user_blocks(db, user_id)
    if ub.last_checkin_at == today:
        return 0.0, ub.streak_days or 0, "Already checked in today"
    from datetime import timedelta
    yesterday = today - timedelta(days=1)
    if ub.last_checkin_at == yesterday:
        new_streak = (ub.streak_days or 0) + 1
    else:
        new_streak = 1
    ub.last_checkin_at = today
    ub.streak_days = new_streak
    db.add(ub)
    base_amount = _get_reward_amount(db, "daily_checkin")
    total = base_amount
    award_blocks(db, user_id, "daily_checkin", amount=base_amount, description="Daily check-in")
    bonus_msg = ""
    if new_streak >= 30:
        bonus = _get_reward_amount(db, "streak_30")
        award_blocks(db, user_id, "streak_30", amount=bonus, tx_type="bonus", description="30-day streak")
        total += bonus
        bonus_msg = " + 30-day streak bonus!"
    elif new_streak >= 7:
        bonus = _get_reward_amount(db, "streak_7")
        award_blocks(db, user_id, "streak_7", amount=bonus, tx_type="bonus", description="7-day streak")
        total += bonus
        bonus_msg = " + 7-day streak bonus!"
    elif new_streak >= 3:
        bonus = _get_reward_amount(db, "streak_3")
        award_blocks(db, user_id, "streak_3", amount=bonus, tx_type="bonus", description="3-day streak")
        total += bonus
        bonus_msg = " + 3-day streak bonus!"
    db.flush()
    return total, new_streak, f"Checked in! +{total} Blocks (streak {new_streak}){bonus_msg}"
