"""Per-asset extended factors: breakout, velocity, cycle, trap, confluence primitives."""

from __future__ import annotations

import math
from typing import Any, Literal

from app.services.ai_intelligence.alpha_batch import BatchContext

CycleStage = Literal["EARLY", "MID", "LATE", "EXIT"]
TimeHorizon = Literal["IMMEDIATE", "SHORT_TERM", "DEVELOPING"]
SignalFreshness = Literal["NEW", "BUILDING", "AGING", "EXHAUSTED"]
EntrySignal = Literal["pullback_entry", "breakout_continuation", "accumulation_zone", "none"]


def _f(x: Any) -> float | None:
    if x is None:
        return None
    try:
        v = float(x)
        return v if v == v else None
    except (TypeError, ValueError):
        return None


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def volatility_index_from_change(price_change_24h: float | None) -> float:
    a = abs(price_change_24h or 0.0)
    return _clamp((a / 80.0) * 100.0)


def compute_breakout_score(row: dict[str, Any], ctx: BatchContext) -> float:
    tp = ctx.turnover_percentile(row)
    pc24 = abs(_f(row.get("price_change_24h")) or 0.0)
    if tp >= 85 and pc24 < 12.0:
        return 78.0
    if tp >= 75 and pc24 < 18.0:
        return 65.0
    if tp >= 65:
        return 55.0
    return 42.0


def compute_velocity_score(row: dict[str, Any]) -> float:
    p1 = _f(row.get("price_change_1h"))
    p24 = _f(row.get("price_change_24h"))
    p7 = _f(row.get("price_change_7d"))
    if p24 is None:
        return 45.0
    implied_daily = p7 / 7.0 if p7 is not None else p24
    if p1 is not None:
        accel = p1 - (p24 / 24.0) * 1.0
        score = 50.0 + accel * 4.0 + (p24 - implied_daily) * 0.35
    else:
        score = 50.0 + (p24 - implied_daily) * 0.5
    return _clamp(score)


def infer_whale_score(row: dict[str, Any], ctx: BatchContext) -> float:
    pc = _f(row.get("price_change_24h")) or 0.0
    vi = volatility_index_from_change(pc)
    tp = ctx.turnover_percentile(row)
    if pc > 2.0 and vi < 40.0 and 40 <= tp <= 80:
        return 72.0
    if pc > 0 and vi < 55 and tp >= 50:
        return 60.0
    if pc < -3.0 and vi > 60:
        return 28.0
    return 48.0


def classify_cycle_stage(
    row: dict[str, Any],
    ctx: BatchContext,
    *,
    sentiment_hint: float | None,
) -> CycleStage:
    pc = _f(row.get("price_change_24h")) or 0.0
    vi = volatility_index_from_change(pc)
    tp = ctx.turnover_percentile(row)
    sent = sentiment_hint if sentiment_hint is not None else 50.0
    if vi < 45 and 55 <= tp <= 85 and 0 <(abs(pc)) < 6.0:
        return "EARLY"
    if pc > 8.0 and vi > 55 and sent > 58:
        return "LATE"
    if -2 < pc < 2 and sent > 62:
        return "EXIT"
    if pc > 4.0 and tp > 50:
        return "MID"
    if pc <= -3.0:
        return "EXIT"
    return "MID"


def low_conviction_trap(row: dict[str, Any], ctx: BatchContext, narrative_boost: float) -> bool:
    pc = abs(_f(row.get("price_change_24h")) or 0.0)
    tp = ctx.turnover_percentile(row)
    return pc > 15.0 and tp < 45.0 and narrative_boost < 8.0


def estimate_time_horizon(velocity: float, breakout: float, rank_delta: int) -> TimeHorizon:
    if velocity > 62 or breakout > 70 or rank_delta >= 4:
        return "IMMEDIATE"
    if velocity > 52 or breakout > 58 or rank_delta >= 2:
        return "SHORT_TERM"
    return "DEVELOPING"


def estimate_freshness(rank_delta: int, velocity: float, prev_velocity: float | None) -> SignalFreshness:
    if prev_velocity is None:
        return "NEW" if abs(rank_delta) >= 2 else "BUILDING"
    if velocity > prev_velocity + 5:
        return "BUILDING"
    if velocity < prev_velocity - 8:
        return "EXHAUSTED"
    if abs(velocity - prev_velocity) < 2:
        return "AGING"
    return "BUILDING"


def entry_zone_signal(row: dict[str, Any], ctx: BatchContext, stage: CycleStage, breakout: float) -> EntrySignal:
    p1 = _f(row.get("price_change_1h"))
    p24 = _f(row.get("price_change_24h")) or 0.0
    rs = ctx.relative_strength_score(row)
    if rs > 58 and p24 > 3.0 and p1 is not None and p1 < p24 / 4.0:
        return "pullback_entry"
    if breakout > 65 and stage in ("MID", "LATE"):
        return "breakout_continuation"
    if stage == "EARLY" and ctx.turnover_percentile(row) >= 55:
        return "accumulation_zone"
    return "none"


def confluence_flags(
    row: dict[str, Any],
    ctx: BatchContext,
    *,
    breakout: float,
    velocity: float,
    whale: float,
    narrative_intensity: float,
    rel: float,
    regime_ok: bool,
) -> tuple[int, list[str]]:
    flags: list[str] = []
    n = 0
    if breakout >= 58:
        n += 1
        flags.append("breakout")
    if velocity >= 55:
        n += 1
        flags.append("velocity")
    if narrative_intensity >= 58:
        n += 1
        flags.append("narrative")
    if rel >= 58:
        n += 1
        flags.append("rel_strength")
    if whale >= 58:
        n += 1
        flags.append("whale")
    if regime_ok:
        n += 1
        flags.append("regime")
    return n, flags


def momentum_volume_scores(row: dict[str, Any], timeframe: str) -> tuple[float, float]:
    from app.services.ai_intelligence.scoring_engine import _score_momentum, _score_volume

    pc24 = _f(row.get("price_change_24h"))
    pc7 = _f(row.get("price_change_7d"))
    vol = _f(row.get("volume_24h"))
    mcap = _f(row.get("market_cap"))
    mom = _score_momentum(pc24, pc7, "7d" if timeframe == "7d" else "24h")
    vols = _score_volume(vol, mcap)
    return mom, vols
