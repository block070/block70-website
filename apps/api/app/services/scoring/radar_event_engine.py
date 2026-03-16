from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional

from sqlalchemy.orm import Session

from app.models import RadarSignal


@dataclass
class RadarEvent:
    """
    Aggregated radar event for a given token / chain.

    Derived from one or more RadarSignal records grouped by token_symbol
    (and optionally chain), with an overall event_score capturing how
    strong and confirmed the radar activity is.
    """

    token_symbol: str
    chain: Optional[str]
    event_score: float
    signal_count: int
    avg_signal_strength: float
    avg_confidence_score: float
    recency_score: float
    latest_signal_at: datetime
    signal_types: List[str]


class RadarEventEngine:
    """
    Engine that aggregates RadarSignal records into higher-level RadarEvent
    objects suitable for powering a crypto radar UI.

    Grouping:
    - primarily by token_symbol
    - chain is tracked but not required for grouping (tokens can be multi-chain)

    Scoring:
      event_score =
        signal_count      * 0.35 +
        signal_strength   * 0.30 +
        confidence_score  * 0.20 +
        recency_score     * 0.15

    where:
    - signal_count is normalized into [0,1] relative to a soft cap
    - signal_strength is the average signal_strength
    - confidence_score is the average confidence_score
    - recency_score favors very recent signals
    """

    def __init__(self, *, max_signals_for_normalization: int = 10) -> None:
        self._max_signals = max(1, int(max_signals_for_normalization))

    def _compute_recency_score(self, latest_ts: datetime, now: datetime) -> float:
        """
        Compute a recency score in [0,1] based on how recent the latest signal is.

        - 0–1h  -> ~1.0
        - 1–24h -> decays towards ~0.4
        - >24h  -> ~0.2
        """
        if latest_ts.tzinfo is None:
            latest_ts = latest_ts.replace(tzinfo=timezone.utc)
        delta_hours = max(
            0.0, (now - latest_ts).total_seconds() / 3600.0
        )

        if delta_hours <= 1:
            return 1.0
        if delta_hours <= 24:
            # Linear decay from 1.0 at 1h to 0.4 at 24h.
            return max(0.4, 1.0 - (delta_hours - 1.0) / 23.0 * 0.6)
        return 0.2

    def _score_event(
        self,
        signal_count: int,
        avg_strength: float,
        avg_confidence: float,
        recency_score: float,
    ) -> float:
        # Normalize count into [0,1] with a soft cap.
        count_component = max(
            0.0, min(signal_count / float(self._max_signals), 1.0)
        )
        strength_component = max(0.0, min(avg_strength, 1.0))
        confidence_component = max(0.0, min(avg_confidence, 1.0))
        recency_component = max(0.0, min(recency_score, 1.0))

        return (
            count_component * 0.35
            + strength_component * 0.30
            + confidence_component * 0.20
            + recency_component * 0.15
        )

    def aggregate(
        self,
        db: Session,
        *,
        since: Optional[datetime] = None,
        min_event_score: float = 0.4,
    ) -> List[RadarEvent]:
        """
        Aggregate RadarSignal records into RadarEvent objects.

        - since: optional lower bound on created_at to restrict signals.
        - min_event_score: minimum score required to return an event.
        """
        query = db.query(RadarSignal)
        if since is not None:
            if since.tzinfo is None:
                since = since.replace(tzinfo=timezone.utc)
            query = query.filter(RadarSignal.created_at >= since)

        signals: List[RadarSignal] = list(query.all())
        if not signals:
            return []

        by_token: Dict[str, List[RadarSignal]] = defaultdict(list)
        for sig in signals:
            token = sig.token_symbol or "UNKNOWN"
            by_token[token].append(sig)

        now = datetime.now(timezone.utc)
        events: List[RadarEvent] = []

        for token, token_signals in by_token.items():
            signal_count = len(token_signals)
            if signal_count == 0:
                continue

            avg_strength = sum(
                float(s.signal_strength or 0.0) for s in token_signals
            ) / signal_count
            avg_confidence = sum(
                float(s.confidence_score or 0.0) for s in token_signals
            ) / signal_count

            latest_signal = max(
                token_signals, key=lambda s: s.created_at or now
            )
            recency_score = self._compute_recency_score(
                latest_signal.created_at or now, now
            )

            event_score = self._score_event(
                signal_count, avg_strength, avg_confidence, recency_score
            )

            if event_score < min_event_score:
                continue

            chains = {s.chain for s in token_signals if s.chain}
            chain = chains.pop() if len(chains) == 1 else None
            signal_types = sorted(
                {s.signal_type for s in token_signals}
            )

            events.append(
                RadarEvent(
                    token_symbol=token,
                    chain=chain,
                    event_score=event_score,
                    signal_count=signal_count,
                    avg_signal_strength=avg_strength,
                    avg_confidence_score=avg_confidence,
                    recency_score=recency_score,
                    latest_signal_at=latest_signal.created_at or now,
                    signal_types=signal_types,
                )
            )

        # Sort events by event_score descending.
        events.sort(key=lambda e: e.event_score, reverse=True)
        return events

