"""
Signals Feed API.

Endpoints:
- GET /api/v1/signals       — list signals with filters (chain, signal_type, token)
- GET /api/v1/signals/latest — latest signals (limit, ordering)
- GET /api/v1/signals/trending — tokens ranked by signal activity
- GET /api/v1/signals/leaderboard — leaderboard by strength/count/confidence
- GET /api/v1/signals/{token} — signals for a given token

Premium signal features (tier query param):
- free: delayed signals (only signals older than 15 minutes)
- pro: real-time signals
- elite: real-time + signal_alert subscriptions and advanced analytics
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user, get_current_user_optional
from app.core.plan_access import has_access, has_feature
from app.db import get_db
from app.models import Signal, SharedSignal, User
from app.services.auth.plan_access import resolve_effective_plan
from app.services.usage.metrics import record_usage_metric
from app.schemas.signals import SignalRead
from app.services.social.signal_card_generator import generate_signal_card
from app.services.analysis.trending_signal_engine import (
    TrendingSignalEngine,
    TrendingSignalToken,
)


router = APIRouter(prefix="/api/v1/signals", tags=["signals"])


def _signal_feed_policy(db: Session, user: User | None) -> tuple[int, int]:
    """Returns (delay_minutes, max_rows). delay 0 = real-time."""
    eff = resolve_effective_plan(db, user)
    if has_feature(eff, "signals_high"):
        return 0, 500
    if has_access(eff, "pro"):
        return 5, 150
    return 15, 40


def _maybe_record_signals_used(db: Session, user: User | None) -> None:
    if user is not None:
        record_usage_metric(db, user.id, "signals_used", 1)


def _serialize_trending(t: TrendingSignalToken) -> dict:
    return {
        "token_symbol": t.token_symbol,
        "token_address": t.token_address,
        "chain": t.chain,
        "signal_count": t.signal_count,
        "avg_confidence_score": round(t.avg_confidence_score, 4),
        "avg_signal_strength": round(t.avg_signal_strength, 4),
        "trend_direction": t.trend_direction,
        "latest_signal_at": t.latest_signal_at.isoformat() if t.latest_signal_at else None,
    }


@router.get("", response_model=List[SignalRead])
def list_signals(
    db: Session = Depends(get_db),
    chain: Optional[str] = Query(
        default=None,
        description="Filter by chain (e.g. ethereum, solana).",
    ),
    signal_type: Optional[str] = Query(
        default=None,
        description="Filter by signal_type (e.g. wallet_accumulation, volume_spike).",
    ),
    token: Optional[str] = Query(
        default=None,
        description="Filter by token symbol or address.",
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
        description="Maximum number of signals to return.",
    ),
    offset: int = Query(
        default=0,
        ge=0,
        description="Number of signals to skip.",
    ),
    tier: Optional[str] = Query(
        default=None,
        description="Deprecated: feed tier is derived from the signed-in user's plan.",
    ),
    current_user: User | None = Depends(get_current_user_optional),
) -> List[Signal]:
    """
    List signals with optional filters by chain, signal_type, and token.
    Feed delay and row caps follow plan (free delayed, pro near-real-time, elite+ quant full).
    """
    q = db.query(Signal)
    delay_m, max_rows = _signal_feed_policy(db, current_user)
    _ = tier  # legacy param ignored
    if delay_m > 0:
        delay_cutoff = datetime.now(timezone.utc) - timedelta(minutes=delay_m)
        q = q.filter(Signal.created_at <= delay_cutoff)
    if chain is not None:
        q = q.filter(Signal.chain == chain)
    if signal_type is not None:
        q = q.filter(Signal.signal_type == signal_type)
    if token is not None:
        q = q.filter(
            (Signal.token_symbol == token) | (Signal.token_address == token)
        )
    eff_limit = min(limit, max_rows)
    q = q.order_by(Signal.created_at.desc()).offset(offset).limit(eff_limit)
    rows = list(q.all())
    _maybe_record_signals_used(db, current_user)
    return rows


@router.get("/latest", response_model=List[SignalRead])
def list_latest_signals(
    db: Session = Depends(get_db),
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
        description="Maximum number of recent signals to return.",
    ),
    chain: Optional[str] = Query(
        default=None,
        description="Filter by chain.",
    ),
    signal_type: Optional[str] = Query(
        default=None,
        description="Filter by signal_type.",
    ),
    tier: Optional[str] = Query(
        default=None,
        description="Deprecated: derived from user plan.",
    ),
    current_user: User | None = Depends(get_current_user_optional),
) -> List[Signal]:
    """
    Return the most recent signals. Delay and cap follow subscription tier.
    """
    q = db.query(Signal)
    delay_m, max_rows = _signal_feed_policy(db, current_user)
    _ = tier
    if delay_m > 0:
        delay_cutoff = datetime.now(timezone.utc) - timedelta(minutes=delay_m)
        q = q.filter(Signal.created_at <= delay_cutoff)
    q = q.order_by(Signal.created_at.desc())
    if chain is not None:
        q = q.filter(Signal.chain == chain)
    if signal_type is not None:
        q = q.filter(Signal.signal_type == signal_type)
    eff_limit = min(limit, max_rows)
    rows = list(q.limit(eff_limit).all())
    _maybe_record_signals_used(db, current_user)
    return rows


@router.get("/trending")
def list_trending_signals(
    db: Session = Depends(get_db),
    hours: int = Query(
        default=24,
        ge=1,
        le=168,
        description="Look-back window in hours.",
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=100,
        description="Maximum number of tokens to return.",
    ),
) -> List[dict]:
    """
    Return tokens ranked by signal activity (signal count, confidence).
    """
    from datetime import datetime, timedelta, timezone

    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    engine = TrendingSignalEngine(lookback_hours=float(hours))
    results = engine.get_trending(db, since=since, limit=limit)
    return [_serialize_trending(t) for t in results]


@router.get("/leaderboard")
def list_signals_leaderboard(
    db: Session = Depends(get_db),
    hours: int = Query(
        default=24,
        ge=1,
        le=168,
        description="Look-back window in hours.",
    ),
    limit: int = Query(
        default=50,
        ge=1,
        le=100,
        description="Maximum number of tokens to return.",
    ),
    sort_by: Optional[str] = Query(
        default="signal_strength",
        description="Sort by: signal_strength, signal_count, confidence_score.",
    ),
    current_user: User | None = Depends(get_current_user_optional),
) -> List[dict]:
    """
    Rank tokens by signal strength, number of signals, or confidence score.
    """
    from datetime import datetime, timedelta, timezone

    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    engine = TrendingSignalEngine(lookback_hours=float(hours))
    results = engine.get_leaderboard(db, since=since, limit=limit, sort_by=sort_by or "signal_strength")
    out = [_serialize_trending(t) for t in results]
    _maybe_record_signals_used(db, current_user)
    return out


@router.get("/share-card/{signal_id}")
def get_signal_share_card(
    signal_id: int = Path(..., description="Signal ID"),
    db: Session = Depends(get_db),
) -> Response:
    """Generate shareable signal card image (PNG). No auth required."""
    signal = db.get(Signal, signal_id)
    if not signal:
        raise HTTPException(404, "Signal not found")
    try:
        png_bytes = generate_signal_card(
            token_symbol=signal.token_symbol or "",
            signal_type=signal.signal_type or "signal",
            confidence_score=float(signal.confidence_score or 0),
            created_at=signal.created_at,
            title=signal.title,
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to generate card: {e}") from e
    return Response(content=png_bytes, media_type="image/png")


@router.post("/share/{signal_id}")
def record_signal_share(
    signal_id: int = Path(..., description="Signal ID"),
    platform: str = Query(..., description="Share platform: twitter, telegram, discord, copy"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Record a signal share for analytics. Returns the share card URL."""
    signal = db.get(Signal, signal_id)
    if not signal:
        raise HTTPException(404, "Signal not found")
    shared = SharedSignal(
        signal_id=signal_id,
        shared_by_user=current_user.id,
        share_platform=platform,
    )
    db.add(shared)
    from app.services.rewards.reward_engine import award_blocks
    award_blocks(db, current_user.id, "signal_share", description=f"Signal shared to {platform}")
    db.commit()
    card_url = f"/api/v1/signals/share-card/{signal_id}"
    return {"card_url": card_url, "recorded": True}


@router.get("/{token}", response_model=List[SignalRead])
def get_signals_for_token(
    token: str = Path(..., description="Token symbol or address to fetch signals for."),
    db: Session = Depends(get_db),
    chain: Optional[str] = Query(
        default=None,
        description="Filter by chain.",
    ),
    signal_type: Optional[str] = Query(
        default=None,
        description="Filter by signal_type.",
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
        description="Maximum number of signals to return.",
    ),
    current_user: User | None = Depends(get_current_user_optional),
) -> List[Signal]:
    """
    Return all signals for the given token (symbol or address).
    """
    q = db.query(Signal).filter(
        (Signal.token_symbol == token) | (Signal.token_address == token)
    )
    if chain is not None:
        q = q.filter(Signal.chain == chain)
    if signal_type is not None:
        q = q.filter(Signal.signal_type == signal_type)
    q = q.order_by(Signal.created_at.desc()).limit(limit)
    rows = list(q.all())
    _maybe_record_signals_used(db, current_user)
    return rows
