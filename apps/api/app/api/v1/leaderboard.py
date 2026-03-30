"""
Leaderboards: Blocks balance, trader performance (backtests), optional user stats.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Dict, List

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import (
    StrategyBacktest,
    TradingStrategy,
    User,
    UserBlocks,
    UserReputation,
)

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


class TraderSort(str, Enum):
    roi = "roi"
    win_rate = "win_rate"


class TraderPeriod(str, Enum):
    d7 = "7d"
    d30 = "30d"
    d90 = "90d"
    all = "all"


def _period_cutoff(period: TraderPeriod) -> datetime | None:
    if period == TraderPeriod.all:
        return None
    now = datetime.now(timezone.utc)
    days = {"7d": 7, "30d": 30, "90d": 90}[period.value]
    return now - timedelta(days=days)


def _latest_backtests_in_window(
    db: Session,
    strategy_ids: List[int],
    cutoff: datetime | None,
) -> Dict[int, StrategyBacktest]:
    if not strategy_ids:
        return {}
    q = db.query(StrategyBacktest).filter(StrategyBacktest.strategy_id.in_(strategy_ids))
    if cutoff is not None:
        q = q.filter(StrategyBacktest.created_at >= cutoff)
    backtests = q.order_by(
        StrategyBacktest.strategy_id,
        StrategyBacktest.created_at.desc(),
    ).all()
    by_strategy: Dict[int, StrategyBacktest] = {}
    for b in backtests:
        if b.strategy_id not in by_strategy:
            by_strategy[b.strategy_id] = b
    return by_strategy


def _pick_best_per_user(
    strategies: List[TradingStrategy],
    by_strategy: Dict[int, StrategyBacktest],
    sort: TraderSort,
) -> Dict[int, tuple[TradingStrategy, StrategyBacktest]]:
    strat_by_id = {s.id: s for s in strategies}
    best: Dict[int, tuple[TradingStrategy, StrategyBacktest]] = {}
    for sid, b in by_strategy.items():
        s = strat_by_id.get(sid)
        if s is None:
            continue
        uid = s.user_id
        roi = float(b.total_return_pct or 0)
        wr = float(b.win_rate or 0)
        trades = int(b.total_trades or 0)
        if uid not in best:
            best[uid] = (s, b)
            continue
        os, ob = best[uid]
        oroi = float(ob.total_return_pct or 0)
        owr = float(ob.win_rate or 0)
        otr = int(ob.total_trades or 0)
        if sort == TraderSort.roi:
            if roi > oroi or (roi == oroi and trades > otr):
                best[uid] = (s, b)
        else:
            if wr > owr or (wr == owr and trades > otr):
                best[uid] = (s, b)
    return best


def _badges_for_row(
    rank: int,
    total_trades: int,
    reputation_score: float | None,
) -> List[str]:
    badges: List[str] = []
    if rank == 1:
        badges.append("champion")
    elif rank == 2:
        badges.append("runner_up")
    elif rank == 3:
        badges.append("third")
    if rank <= 10:
        badges.append("elite")
    if total_trades >= 20:
        badges.append("proven")
    if reputation_score is not None and reputation_score >= 500:
        badges.append("community_star")
    return badges


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


@router.get("/traders", response_model=List[dict])
def traders_leaderboard(
    db: Session = Depends(get_db),
    sort: TraderSort = Query(TraderSort.roi),
    period: TraderPeriod = Query(TraderPeriod.all),
    strategy_id: int | None = Query(None),
    public_only: bool = Query(True),
    limit: int = Query(100, ge=1, le=500),
) -> List[dict]:
    """
    Rank users by best public (or all) strategy backtest in the time window.
    One row per user; metrics come from the single best strategy for the active sort.
    """
    cutoff = _period_cutoff(period)
    q = db.query(TradingStrategy)
    if public_only:
        q = q.filter(TradingStrategy.is_public == True)
    if strategy_id is not None:
        q = q.filter(TradingStrategy.id == strategy_id)
    strategies = q.all()
    strategy_ids = [s.id for s in strategies]
    by_strategy = _latest_backtests_in_window(db, strategy_ids, cutoff)
    if not by_strategy:
        return []

    best_per_user = _pick_best_per_user(strategies, by_strategy, sort)
    if not best_per_user:
        return []

    user_ids = list(best_per_user.keys())
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
    reps = {
        r.user_id: r
        for r in db.query(UserReputation).filter(UserReputation.user_id.in_(user_ids)).all()
    }

    scored: List[tuple] = []
    for uid, (s, b) in best_per_user.items():
        u = users.get(uid)
        name = u.name if u else f"User {uid}"
        roi = float(b.total_return_pct or 0)
        wr = float(b.win_rate or 0)
        scored.append((uid, name, s, b, roi, wr))

    if sort == TraderSort.roi:
        scored.sort(key=lambda x: (-x[4], -(x[3].total_trades or 0), x[0]))
    else:
        scored.sort(key=lambda x: (-x[5], -(x[3].total_trades or 0), x[0]))

    out: List[dict] = []
    for rank, (uid, name, s, b, roi, wr) in enumerate(scored[:limit], 1):
        rep = reps.get(uid)
        rep_score = float(rep.reputation_score) if rep else None
        out.append(
            {
                "rank": rank,
                "user_id": uid,
                "name": name,
                "roi": roi,
                "win_rate": wr,
                "total_trades": int(b.total_trades or 0),
                "strategy_id": s.id,
                "strategy_name": s.strategy_name,
                "badges": _badges_for_row(rank, int(b.total_trades or 0), rep_score),
            }
        )
    return out


@router.get("/users/{user_id}/trading-stats", response_model=Dict[str, object])
def user_trading_stats(
    user_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> Dict[str, object]:
    """Best public backtest row for a user (all time), for profile snippets."""
    strategies = (
        db.query(TradingStrategy)
        .filter(
            TradingStrategy.user_id == user_id,
            TradingStrategy.is_public == True,
        )
        .all()
    )
    if not strategies:
        return {"has_stats": False}

    strategy_ids = [s.id for s in strategies]
    by_strategy = _latest_backtests_in_window(db, strategy_ids, None)
    if not by_strategy:
        return {"has_stats": False}

    best = _pick_best_per_user(strategies, by_strategy, TraderSort.roi)
    row = best.get(user_id)
    if not row:
        return {"has_stats": False}
    s, b = row
    return {
        "has_stats": True,
        "roi": float(b.total_return_pct or 0),
        "win_rate": float(b.win_rate or 0),
        "total_trades": int(b.total_trades or 0),
        "strategy_id": s.id,
        "strategy_name": s.strategy_name,
    }
