"""
Blocks balance and transaction history.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import BlockTransaction, User, UserBlocks
from app.services.rewards.reward_engine import get_or_create_user_blocks

router = APIRouter(prefix="/api/v1/blocks", tags=["blocks"])


@router.get("/balance")
def get_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Get current user's Blocks balance and streak."""
    ub = get_or_create_user_blocks(db, current_user.id)
    return {
        "balance": float(ub.balance or 0),
        "streak_days": ub.streak_days or 0,
        "last_checkin_at": ub.last_checkin_at.isoformat() if ub.last_checkin_at else None,
    }


@router.get("/transactions", response_model=List[dict])
def list_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> List[dict]:
    """List Block transactions for current user (earn, spend, bonus)."""
    rows = (
        db.query(BlockTransaction)
        .filter(BlockTransaction.user_id == current_user.id)
        .order_by(BlockTransaction.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": t.id,
            "transaction_type": t.transaction_type,
            "amount": t.amount,
            "description": t.description,
            "created_at": (t.created_at or datetime.now(timezone.utc)).isoformat(),
        }
        for t in rows
    ]
