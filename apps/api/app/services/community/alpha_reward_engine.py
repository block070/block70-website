"""
Alpha reward engine: reward users for high engagement, correct signals, and strategy performance.
"""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    AlphaPost,
    AlphaVote,
    CreatorReward,
    UserReputation,
    TradingStrategy,
    StrategyBacktest,
)


# Reward type constants
REWARD_ALPHA_ENGAGEMENT = "alpha_engagement"
REWARD_ALPHA_CORRECT = "alpha_signal_correct"
REWARD_STRATEGY_PERFORMANCE = "strategy_performance"
REWARD_REPUTATION_BONUS = "reputation_bonus"


def _get_or_create_reputation(db: Session, user_id: int) -> UserReputation | None:
    r = db.query(UserReputation).filter(UserReputation.user_id == user_id).first()
    if r:
        return r
    r = UserReputation(user_id=user_id, reputation_score=0.0)
    db.add(r)
    db.flush()
    return r


def grant_reward(
    db: Session,
    user_id: int,
    reward_type: str,
    amount: float,
) -> CreatorReward:
    """Create a CreatorReward record and optionally update reputation."""
    reward = CreatorReward(
        user_id=user_id,
        reward_type=reward_type,
        reward_amount=amount,
    )
    db.add(reward)
    rep = _get_or_create_reputation(db, user_id)
    if rep:
        rep.reputation_score = (rep.reputation_score or 0) + amount
    db.flush()
    return reward


def reward_alpha_engagement(db: Session, post_id: int) -> CreatorReward | None:
    """
    Reward post author when their alpha post gains high engagement (votes).
    Threshold: e.g. 10+ votes in a window.
    """
    post = db.get(AlphaPost, post_id)
    if not post:
        return None
    vote_count = (
        db.query(func.count(AlphaVote.id))
        .filter(AlphaVote.post_id == post_id)
        .scalar() or 0
    )
    if vote_count < 10:
        return None
    # One-time engagement reward (caller may track which posts were already rewarded)
    amount = min(5.0, 1.0 + vote_count * 0.2)
    return grant_reward(db, post.user_id, REWARD_ALPHA_ENGAGEMENT, amount)


def reward_alpha_correct(db: Session, user_id: int, amount: float = 2.0) -> CreatorReward:
    """Reward user when their signal/alpha proved correct (called by accuracy pipeline)."""
    return grant_reward(db, user_id, REWARD_ALPHA_CORRECT, amount)


def reward_strategy_performance(
    db: Session,
    strategy_id: int,
    roi_or_score: float,
) -> CreatorReward | None:
    """Reward strategy author when backtest or live performance is strong."""
    strategy = db.get(TradingStrategy, strategy_id)
    if not strategy or roi_or_score < 0.05:
        return None
    amount = min(10.0, roi_or_score * 5.0)  # scale by ROI
    return grant_reward(db, strategy.user_id, REWARD_STRATEGY_PERFORMANCE, amount)


def process_engagement_rewards(db: Session, post_ids: list[int]) -> list[CreatorReward]:
    """Process engagement rewards for a set of posts (e.g. batch job)."""
    rewards = []
    for pid in post_ids:
        r = reward_alpha_engagement(db, pid)
        if r:
            rewards.append(r)
    return rewards
