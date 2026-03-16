"""
Seed default RewardAction and RewardItem rows if they don't exist.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import RewardAction, RewardItem


DEFAULT_ACTIONS = [
    ("daily_checkin", 5.0, "Daily check-in"),
    ("referral_signup", 25.0, "Referral signed up"),
    ("referral_active", 50.0, "Referral became active"),
    ("alpha_post", 10.0, "Alpha post created"),
    ("alpha_upvotes", 2.0, "Alpha post upvotes"),
    ("alpha_accurate", 20.0, "Alpha proved accurate"),
    ("strategy_created", 15.0, "Strategy created"),
    ("strategy_performed", 30.0, "Strategy performed well"),
    ("signal_share", 3.0, "Signal shared"),
    ("streak_3", 10.0, "3-day check-in streak"),
    ("streak_7", 25.0, "7-day check-in streak"),
    ("streak_30", 100.0, "30-day check-in streak"),
]

DEFAULT_ITEMS = [
    ("1 day Premium", "24 hours of premium access", 50.0, "premium_access"),
    ("Signal alerts pack", "10 premium signal alerts", 30.0, "signal_alerts"),
    ("Strategy credits", "5 strategy backtest credits", 40.0, "strategy_credits"),
]


def seed_rewards(db: Session) -> None:
    for action_type, amount, desc in DEFAULT_ACTIONS:
        if db.query(RewardAction).filter(RewardAction.action_type == action_type).first():
            continue
        db.add(RewardAction(action_type=action_type, reward_amount=amount, description=desc))
    for name, description, cost, reward_type in DEFAULT_ITEMS:
        if db.query(RewardItem).filter(RewardItem.name == name).first():
            continue
        db.add(RewardItem(name=name, description=description, block_cost=cost, reward_type=reward_type))
    db.commit()
