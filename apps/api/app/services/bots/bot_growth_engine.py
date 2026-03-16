"""
Automatically share popular signals to public channels.
Can be used to post high-engagement or high-confidence signals to a designated public Telegram/Discord.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import BotSignalEvent, Signal, SignalBot
from app.services.bots.bot_dispatcher import run_signal_bot_dispatcher
from app.services.bots.discord_bot import send_discord_signal_alert
from app.services.bots.telegram_bot import send_telegram_signal_alert


def get_popular_signals(
    db: Session,
    since_hours: int = 24,
    min_confidence: float = 0.7,
    limit: int = 5,
) -> list[Signal]:
    """Signals with high confidence not yet sent to public bot (by signal_id)."""
    since = datetime.now(timezone.utc) - timedelta(hours=since_hours)
    return (
        db.query(Signal)
        .filter(
            Signal.created_at >= since,
            Signal.confidence_score >= min_confidence,
        )
        .order_by(Signal.confidence_score.desc())
        .limit(limit * 2)
        .all()
    )


def share_popular_to_public_bot(
    db: Session,
    public_bot_id: int,
) -> int:
    """
    Send top popular (high-confidence) signals to a designated public bot.
    public_bot_id: ID of a SignalBot marked for public channel (e.g. is_public in config_json).
    Returns number of messages sent.
    """
    bot = db.get(SignalBot, public_bot_id)
    if not bot or not bot.is_active:
        return 0
    config = bot.config_json or {}
    min_conf = config.get("min_confidence", 0.75)
    signals = get_popular_signals(db, since_hours=2, min_confidence=min_conf, limit=3)
    sent = 0
    for signal in signals:
        already = (
            db.query(BotSignalEvent)
            .filter(BotSignalEvent.signal_id == signal.id, BotSignalEvent.bot_id == bot.id)
            .first()
        )
        if already:
            continue
        if bot.platform == "telegram":
            ok, _ = send_telegram_signal_alert(
                bot.bot_token,
                bot.channel_id,
                token_symbol=signal.token_symbol,
                signal_type=signal.signal_type or "",
                confidence_score=float(signal.confidence_score or 0),
                description=signal.description,
                signal_id=signal.id,
                chain=signal.chain,
                title=signal.title,
            )
        else:
            ok, _ = send_discord_signal_alert(
                bot.bot_token,
                token_symbol=signal.token_symbol,
                signal_type=signal.signal_type or "",
                confidence_score=float(signal.confidence_score or 0),
                description=signal.description,
                signal_id=signal.id,
                chain=signal.chain,
                title=signal.title,
            )
        if ok:
            ev = BotSignalEvent(signal_id=signal.id, bot_id=bot.id, status="sent")
            db.add(ev)
            sent += 1
    db.flush()
    return sent
