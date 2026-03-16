"""
Dispatch new signals to all active bots (Telegram and Discord).
Rate limit: max 10 signals/hour per bot.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models import BotSignalEvent, Signal, SignalBot
from app.services.bots.discord_bot import send_discord_signal_alert
from app.services.bots.telegram_bot import send_telegram_signal_alert

MAX_SIGNALS_PER_BOT_PER_HOUR = 10


def _bot_sent_count_last_hour(db: Session, bot_id: int) -> int:
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    return (
        db.query(BotSignalEvent)
        .filter(BotSignalEvent.bot_id == bot_id, BotSignalEvent.sent_at >= since)
        .count()
    )


def _signal_already_sent_to_bot(db: Session, signal_id: int, bot_id: int) -> bool:
    return (
        db.query(BotSignalEvent)
        .filter(BotSignalEvent.signal_id == signal_id, BotSignalEvent.bot_id == bot_id)
        .first()
        is not None
    )


def _bot_config(bot: SignalBot) -> dict[str, Any]:
    return bot.config_json or {}


def _signal_matches_bot_config(signal: Signal, config: dict[str, Any]) -> bool:
    if not config:
        return True
    min_conf = config.get("min_confidence")
    if min_conf is not None and (signal.confidence_score or 0) < float(min_conf):
        return False
    signal_types = config.get("signal_types")
    if signal_types and signal.signal_type not in signal_types:
        return False
    token_filter = config.get("token_filter") or []
    if token_filter:
        if signal.token_symbol not in token_filter and signal.token_address not in token_filter:
            return False
    return True


def _get_unsent_signals_for_bot(
    db: Session,
    bot: SignalBot,
    limit: int = 20,
    since_minutes: int = 60,
) -> list[Signal]:
    since = datetime.now(timezone.utc) - timedelta(minutes=since_minutes)
    config = _bot_config(bot)
    candidates = (
        db.query(Signal)
        .filter(Signal.created_at >= since)
        .order_by(Signal.created_at.desc())
        .limit(limit * 2)
        .all()
    )
    out = []
    for s in candidates:
        if len(out) >= limit:
            break
        if _signal_already_sent_to_bot(db, s.id, bot.id):
            continue
        if not _signal_matches_bot_config(s, config):
            continue
        out.append(s)
    return out


def _record_sent(db: Session, signal_id: int, bot_id: int, status: str = "sent") -> None:
    ev = BotSignalEvent(signal_id=signal_id, bot_id=bot_id, status=status)
    db.add(ev)
    db.flush()


def run_signal_bot_dispatcher(db: Session) -> dict[str, int]:
    """
    Detect new signals and send to all active bots.
    Respects per-bot config (min_confidence, signal_types, token_filter) and rate limit.
    Returns {"signals_processed": N, "messages_sent": M}.
    """
    signals_processed = 0
    messages_sent = 0
    active_bots = (
        db.query(SignalBot)
        .filter(SignalBot.is_active == True)
        .all()
    )
    for bot in active_bots:
        sent_this_hour = _bot_sent_count_last_hour(db, bot.id)
        if sent_this_hour >= MAX_SIGNALS_PER_BOT_PER_HOUR:
            continue
        remaining = MAX_SIGNALS_PER_BOT_PER_HOUR - sent_this_hour
        unsent = _get_unsent_signals_for_bot(db, bot, limit=min(remaining, 10), since_minutes=60)
        for signal in unsent:
            signals_processed += 1
            success = False
            if bot.platform == "telegram":
                success, err = send_telegram_signal_alert(
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
            elif bot.platform == "discord":
                success, err = send_discord_signal_alert(
                    bot.bot_token,
                    token_symbol=signal.token_symbol,
                    signal_type=signal.signal_type or "",
                    confidence_score=float(signal.confidence_score or 0),
                    description=signal.description,
                    signal_id=signal.id,
                    chain=signal.chain,
                    title=signal.title,
                )
            status = "sent" if success else "failed"
            _record_sent(db, signal.id, bot.id, status=status)
            if success:
                messages_sent += 1
    return {"signals_processed": signals_processed, "messages_sent": messages_sent}
