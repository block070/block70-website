from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel

from app.models import Opportunity


class TrendSignal(BaseModel):
    """
    High-level trend signal that can be used to enhance opportunity scores
    or drive separate trend dashboards.
    """

    category: Literal[
        "arbitrage_cluster",
        "whale_accumulation",
        "miner_roi_improving",
    ]
    key: str  # e.g. pair or token symbol
    magnitude: float  # 0–1 normalized strength of the trend
    details: Dict[str, object]
    timestamp: datetime


@dataclass
class TrendDetectionConfig:
    """
    Configuration knobs for trend detection.
    """

    recent_window_minutes: int = 60
    arbitrage_min_count: int = 3
    whale_min_count: int = 2
    whale_min_notional_usd: float = 50_000.0
    miner_min_roi_delta_pct: float = 10.0


def _get_now() -> datetime:
    return datetime.now(timezone.utc)


def detect_trends(
    opportunities: List[Opportunity],
    config: Optional[TrendDetectionConfig] = None,
) -> List[TrendSignal]:
    """
    Detect simple category-level trends from a batch of opportunities.

    This function is intentionally read-only and can be called after a pipeline
    run to derive additional context for ranking or UI.
    """
    if not opportunities:
        return []

    cfg = config or TrendDetectionConfig()
    now = _get_now()
    cutoff = now - timedelta(minutes=cfg.recent_window_minutes)

    recent = [op for op in opportunities if (op.detected_at or op.created_at) >= cutoff]

    if not recent:
        return []

    trends: List[TrendSignal] = []

    arbitrage_trends = _detect_arbitrage_trends(recent, now, cfg)
    whale_trends = _detect_whale_trends(recent, now, cfg)
    miner_trends = _detect_miner_trends(recent, now, cfg)

    trends.extend(arbitrage_trends)
    trends.extend(whale_trends)
    trends.extend(miner_trends)

    return trends


def _detect_arbitrage_trends(
    recent: List[Opportunity],
    now: datetime,
    cfg: TrendDetectionConfig,
) -> List[TrendSignal]:
    """
    Detect clusters of arbitrage opportunities in the recent window.
    """
    by_pair: Dict[str, List[Opportunity]] = {}
    for op in recent:
        if op.type != "arbitrage":
            continue
        pair = f"{op.base_symbol}/{op.quote_symbol}" if op.base_symbol and op.quote_symbol else (
            op.asset_symbol or "unknown"
        )
        by_pair.setdefault(pair, []).append(op)

    signals: List[TrendSignal] = []

    for pair, ops in by_pair.items():
        if len(ops) < cfg.arbitrage_min_count:
            continue

        # Magnitude grows with the number of clustered opportunities.
        # Normalize with a soft cap at 10.
        magnitude = min(len(ops) / 10.0, 1.0)

        best_score = max((op.total_score or 0.0) for op in ops)

        signals.append(
            TrendSignal(
                category="arbitrage_cluster",
                key=pair,
                magnitude=magnitude,
                details={
                    "pair": pair,
                    "count": len(ops),
                    "best_score": best_score,
                },
                timestamp=now,
            )
        )

    return signals


def _detect_whale_trends(
    recent: List[Opportunity],
    now: datetime,
    cfg: TrendDetectionConfig,
) -> List[TrendSignal]:
    """
    Detect repeated large wallet-driven buys / accumulations in the same token.
    """
    by_token: Dict[str, List[Opportunity]] = {}
    for op in recent:
        if op.type != "wallet":
            continue
        if (op.estimated_upside or 0.0) * 1.0 < cfg.whale_min_notional_usd:
            # estimated_upside is used here as a proxy for notional opportunity size.
            continue
        token = op.asset_symbol or "unknown"
        by_token.setdefault(token, []).append(op)

    signals: List[TrendSignal] = []

    for token, ops in by_token.items():
        if len(ops) < cfg.whale_min_count:
            continue

        magnitude = min(len(ops) / 5.0, 1.0)
        max_score = max((op.total_score or 0.0) for op in ops)

        signals.append(
            TrendSignal(
                category="whale_accumulation",
                key=token,
                magnitude=magnitude,
                details={
                    "token": token,
                    "count": len(ops),
                    "max_score": max_score,
                },
                timestamp=now,
            )
        )

    return signals


def _detect_miner_trends(
    recent: List[Opportunity],
    now: datetime,
    cfg: TrendDetectionConfig,
) -> List[TrendSignal]:
    """
    Detect improving miner ROI for a given asset over time.
    """
    by_token: Dict[str, List[Opportunity]] = {}
    for op in recent:
        if op.type != "mining":
            continue
        token = op.asset_symbol or "unknown"
        by_token.setdefault(token, []).append(op)

    signals: List[TrendSignal] = []

    for token, ops in by_token.items():
        if len(ops) < 2:
            continue

        # Sort by detected_at, then compare earliest vs latest ROI.
        ops_sorted = sorted(
            ops,
            key=lambda o: o.detected_at or o.created_at or now,
        )
        first = ops_sorted[0]
        last = ops_sorted[-1]

        first_roi = first.estimated_roi_percent or 0.0
        last_roi = last.estimated_roi_percent or 0.0
        delta = last_roi - first_roi

        if delta < cfg.miner_min_roi_delta_pct:
            continue

        # Normalize magnitude over a 50% delta band.
        magnitude = max(0.0, min(delta / 50.0, 1.0))

        signals.append(
            TrendSignal(
                category="miner_roi_improving",
                key=token,
                magnitude=magnitude,
                details={
                    "token": token,
                    "first_roi_percent": first_roi,
                    "last_roi_percent": last_roi,
                    "delta_roi_percent": delta,
                },
                timestamp=now,
            )
        )

    return signals

