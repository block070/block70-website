"""
Redeem rewards using Blocks. Deduct balance and create spend transaction.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import BlockTransaction, RewardItem, UserBlocks
from app.services.rewards.reward_engine import get_or_create_user_blocks


def redeem_reward(
    db: Session,
    user_id: int,
    reward_item_id: int,
) -> tuple[bool, str, UserBlocks | None]:
    """
    Redeem a reward item with Blocks. Returns (success, message, user_blocks or None).
    On success: deduct block_cost from balance, create spend transaction.
    """
    item = db.get(RewardItem, reward_item_id)
    if not item:
        return False, "Reward not found", None
    ub = get_or_create_user_blocks(db, user_id)
    cost = float(item.block_cost)
    if cost <= 0:
        return False, "Invalid reward cost", None
    balance = ub.balance or 0
    if balance < cost:
        return False, f"Insufficient Blocks (need {cost}, have {balance})", None
    ub.balance = balance - cost
    db.add(ub)
    tx = BlockTransaction(
        user_id=user_id,
        transaction_type="spend",
        amount=-cost,
        description=f"Redeem: {item.name} ({item.reward_type})",
    )
    db.add(tx)
    db.flush()
    return True, f"Redeemed {item.name}", ub
