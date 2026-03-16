"""
Signal Aggregation Engine.

Combines multiple signals related to the same token into a single
aggregated signal event (e.g. wallet buys + volume spike + radar alert).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import Signal


@dataclass
class AggregatedSignalEvent:
    """
    One aggregated event per token (and optionally chain), combining
    multiple source signals with combined scores and a list of signal types.
    """

    token_symbol: Optional[str]
    token_address: Optional[str]
    chain: Optional[str]
    signal_strength: float
    confidence_score: float
    signal_count: int
    signal_types: List[str]
    sources: List[str]
    latest_at: Optional[datetime]
    title: str
    description: str
    source_signal_ids: List[int] = field(default_factory=list)


class SignalAggregationEngine:
    """
    Groups signals by token (token_symbol/token_address) and chain,
    then produces one AggregatedSignalEvent per group with combined
    strength and confidence (e.g. weighted average) and optional
    persistence as a single Signal with signal_type="aggregated".
    """

    def __init__(
        self,
        *,
        strength_weights: Optional[dict] = None,
        min_signals_to_aggregate: int = 2,
    ) -> None:
        self.min_signals_to_aggregate = max(1, min_signals_to_aggregate)
        self.strength_weights = strength_weights or {}

    def _group_key(self, s: Signal) -> tuple:
        return (
            (s.token_symbol or "").strip() or None,
            (s.token_address or "").strip() or None,
            (s.chain or "").strip() or None,
        )

    def aggregate(
        self,
        signals: List[Signal],
        *,
        min_signals: Optional[int] = None,
    ) -> List[AggregatedSignalEvent]:
        """
        Group signals by token_symbol/token_address and chain; for each group
        with at least min_signals (default min_signals_to_aggregate), produce
        one AggregatedSignalEvent with combined strength and confidence.
        """
        if not signals:
            return []
        min_n = min_signals if min_signals is not None else self.min_signals_to_aggregate
        groups: dict[tuple, List[Signal]] = {}
        for s in signals:
            key = self._group_key(s)
            if key not in groups:
                groups[key] = []
            groups[key].append(s)

        out: List[AggregatedSignalEvent] = []
        for key, group in groups.items():
            if len(group) < min_n:
                continue
            token_symbol, token_address, chain = key
            types = list({s.signal_type for s in group})
            sources = list({s.source or "unknown" for s in group})
            latest = max(
                (s.created_at for s in group if s.created_at is not None),
                default=None,
            )
            weights = self.strength_weights
            strengths = [
                (s.signal_strength or 0.0) * weights.get(s.signal_type, 1.0)
                for s in group
            ]
            confidences = [s.confidence_score or 0.0 for s in group]
            avg_strength = sum(strengths) / len(strengths) if strengths else 0.0
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            # Cap at 1.0 (boost when multiple signals agree)
            combined_strength = min(1.0, avg_strength * (1.0 + 0.2 * (len(group) - 1)))
            combined_confidence = min(1.0, avg_confidence * (1.0 + 0.1 * (len(group) - 1)))
            symbol = token_symbol or (group[0].token_symbol if group else None)
            title = f"Aggregated: {len(group)} signals for {symbol or 'token'}"
            description = (
                f"Combined {', '.join(types)} from {', '.join(sources)}. "
                f"Strength={combined_strength:.2f}, confidence={combined_confidence:.2f}."
            )
            source_ids = [s.id for s in group if getattr(s, "id", None) is not None]
            out.append(
                AggregatedSignalEvent(
                    token_symbol=token_symbol or symbol,
                    token_address=token_address,
                    chain=chain,
                    signal_strength=round(combined_strength, 4),
                    confidence_score=round(combined_confidence, 4),
                    signal_count=len(group),
                    signal_types=types,
                    sources=sources,
                    latest_at=latest,
                    title=title,
                    description=description,
                    source_signal_ids=source_ids,
                )
            )
        return out

    def aggregate_and_persist(
        self,
        db: Session,
        signals: List[Signal],
        *,
        min_signals: Optional[int] = None,
    ) -> List[Signal]:
        """
        Run aggregate(), then for each AggregatedSignalEvent create a new
        Signal with signal_type="aggregated" and persist it.
        """
        events = self.aggregate(signals, min_signals=min_signals)
        created: List[Signal] = []
        for ev in events:
            sig = Signal(
                signal_type="aggregated",
                token_symbol=ev.token_symbol,
                token_address=ev.token_address,
                chain=ev.chain,
                title=ev.title,
                description=ev.description,
                signal_strength=ev.signal_strength,
                confidence_score=ev.confidence_score,
                source="signal_aggregation_engine",
                metadata_json={
                    "signal_count": ev.signal_count,
                    "signal_types": ev.signal_types,
                    "sources": ev.sources,
                    "source_signal_ids": ev.source_signal_ids,
                    "latest_at": ev.latest_at.isoformat() if ev.latest_at else None,
                },
            )
            db.add(sig)
            created.append(sig)
        if created:
            db.commit()
            for s in created:
                db.refresh(s)
        return created
