"""
Blocks leaderboard: rank users by balance.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, UserBlocks
from app.services.rewards.reward_engine import get_or_create_user_blocks

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


@router.get("/blocks", response_model=List[dict])
def blocks_leaderboard(
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
) -> List[dict]:
    """Rank users by Blocks balance (UserBlocks.balance desc)."""
    rows = (
        db.query(User, UserBlocks)
        .join(UserBlocks, User.id == UserBlocks.user_id)
        .order_by(UserBlocks.balance.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "rank": rank,
            "user_id": u.id,
            "name": u.name,
            "balance": float(ub.balance or 0),
        }
        for rank, (u, ub) in enumerate(rows, 1)
    ]
