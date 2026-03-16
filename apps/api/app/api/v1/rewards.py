"""
Rewards: check-in, store, redeem. Anti-abuse: one check-in per day.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import RewardItem, User
from app.services.rewards.reward_engine import process_daily_checkin
from app.services.rewards.redeem_engine import redeem_reward

router = APIRouter(prefix="/api/v1/rewards", tags=["rewards"])


@router.post("/checkin")
def checkin(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Daily check-in. Claim Blocks once per calendar day (UTC). Streak bonuses at 3, 7, 30 days."""
    blocks_awarded, streak_days, message = process_daily_checkin(db, current_user.id)
    db.commit()
    return {
        "blocks_awarded": blocks_awarded,
        "streak_days": streak_days,
        "message": message,
    }


@router.get("/store", response_model=List[dict])
def list_store(
    db: Session = Depends(get_db),
) -> List[dict]:
    """List reward items available for purchase with Blocks."""
    rows = (
        db.query(RewardItem)
        .order_by(RewardItem.block_cost.asc())
        .all()
    )
    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "block_cost": float(r.block_cost),
            "reward_type": r.reward_type,
        }
        for r in rows
    ]


@router.post("/redeem/{item_id}")
def redeem(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Redeem a reward item with Blocks."""
    success, message, ub = redeem_reward(db, current_user.id, item_id)
    if not success:
        raise HTTPException(400, message)
    db.commit()
    return {
        "success": True,
        "message": message,
        "balance": float(ub.balance or 0) if ub else 0,
    }
