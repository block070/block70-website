"""
Bot management API: list, create, update, delete signal bots.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import BotSignalEvent, SignalBot, TradingStrategy, User

router = APIRouter(prefix="/api/v1/bots", tags=["bots"])


class BotCreate(BaseModel):
    platform: str
    bot_token: str
    channel_id: str
    config_json: dict[str, Any] | None = None


class BotUpdate(BaseModel):
    is_active: bool | None = None
    config_json: dict[str, Any] | None = None
    strategy_id: int | None = None


class BotRead(BaseModel):
    id: int
    platform: str
    channel_id: str
    is_active: bool
    config_json: dict | None
    created_at: str
    updated_at: str
    signals_sent_24h: int | None = None

    class Config:
        from_attributes = True


@router.get("", response_model=List[dict])
def list_bots(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[dict]:
    """List current user's signal bots."""
    bots = (
        db.query(SignalBot)
        .filter(SignalBot.user_id == current_user.id)
        .order_by(SignalBot.created_at.desc())
        .all()
    )
    out = []
    for b in bots:
        since = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        count_24h = (
            db.query(func.count(BotSignalEvent.id))
            .filter(BotSignalEvent.bot_id == b.id, BotSignalEvent.sent_at >= since)
            .scalar() or 0
        )
        out.append({
            "id": b.id,
            "platform": b.platform,
            "channel_id": b.channel_id,
            "is_active": b.is_active,
            "config_json": b.config_json,
            "strategy_id": b.strategy_id,
            "created_at": (b.created_at or datetime.now(timezone.utc)).isoformat(),
            "updated_at": (b.updated_at or datetime.now(timezone.utc)).isoformat(),
            "signals_sent_24h": count_24h,
        })
    return out


@router.post("", status_code=201)
def create_bot(
    payload: BotCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Create a new signal bot. platform: telegram | discord. For Discord, bot_token is the webhook URL."""
    if payload.platform not in ("telegram", "discord"):
        raise HTTPException(400, "platform must be 'telegram' or 'discord'")
    if payload.strategy_id is not None:
        strat = db.get(TradingStrategy, payload.strategy_id)
        if not strat or strat.user_id != current_user.id:
            raise HTTPException(400, "strategy_id must reference your strategy")
    bot = SignalBot(
        user_id=current_user.id,
        platform=payload.platform,
        bot_token=payload.bot_token,
        channel_id=payload.channel_id,
        config_json=payload.config_json,
        strategy_id=payload.strategy_id,
        is_active=True,
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return {
        "id": bot.id,
        "platform": bot.platform,
        "channel_id": bot.channel_id,
        "is_active": bot.is_active,
        "config_json": bot.config_json,
        "strategy_id": bot.strategy_id,
        "created_at": (bot.created_at or datetime.now(timezone.utc)).isoformat(),
    }


@router.get("/{bot_id}")
def get_bot(
    bot_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Get a single bot."""
    bot = (
        db.query(SignalBot)
        .filter(SignalBot.id == bot_id, SignalBot.user_id == current_user.id)
        .first()
    )
    if not bot:
        raise HTTPException(404, "Bot not found")
    since = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count_24h = (
        db.query(func.count(BotSignalEvent.id))
        .filter(BotSignalEvent.bot_id == bot.id, BotSignalEvent.sent_at >= since)
        .scalar() or 0
    )
    return {
        "id": bot.id,
        "platform": bot.platform,
        "channel_id": bot.channel_id,
        "is_active": bot.is_active,
        "config_json": bot.config_json,
        "strategy_id": bot.strategy_id,
        "created_at": (bot.created_at or datetime.now(timezone.utc)).isoformat(),
        "updated_at": (bot.updated_at or datetime.now(timezone.utc)).isoformat(),
        "signals_sent_24h": count_24h,
    }


@router.patch("/{bot_id}")
def update_bot(
    bot_id: int = Path(...),
    payload: BotUpdate = ...,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Update bot settings (is_active, config_json)."""
    bot = (
        db.query(SignalBot)
        .filter(SignalBot.id == bot_id, SignalBot.user_id == current_user.id)
        .first()
    )
    if not bot:
        raise HTTPException(404, "Bot not found")
    patch = payload.model_dump(exclude_unset=True)
    if "is_active" in patch and patch["is_active"] is not None:
        bot.is_active = patch["is_active"]
    if "config_json" in patch:
        bot.config_json = patch["config_json"]
    if "strategy_id" in patch:
        sid = patch["strategy_id"]
        if sid is not None:
            strat = db.get(TradingStrategy, sid)
            if not strat or strat.user_id != current_user.id:
                raise HTTPException(400, "strategy_id must reference your strategy")
        bot.strategy_id = sid
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return {
        "id": bot.id,
        "platform": bot.platform,
        "channel_id": bot.channel_id,
        "is_active": bot.is_active,
        "config_json": bot.config_json,
        "strategy_id": bot.strategy_id,
    }


@router.delete("/{bot_id}")
def delete_bot(
    bot_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Delete a signal bot."""
    bot = (
        db.query(SignalBot)
        .filter(SignalBot.id == bot_id, SignalBot.user_id == current_user.id)
        .first()
    )
    if not bot:
        raise HTTPException(404, "Bot not found")
    db.delete(bot)
    db.commit()
    return {"status": "deleted", "id": bot_id}
