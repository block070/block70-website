from __future__ import annotations

import logging
from typing import Iterable

from sqlalchemy.orm import Session

from app.models import Signal
from app.services.notifications.dispatch import dispatch_signal_generated

logger = logging.getLogger(__name__)


def _norm_confidence(c: float) -> float:
    if c > 1.0:
        return min(1.0, c / 100.0)
    return float(c or 0.0)


def fanout_after_signals_persisted(db: Session, signals: Iterable[Signal]) -> None:
    """Broadcast at most one high-confidence signal per batch to reduce noise."""
    rows = list(signals)
    if not rows:
        return
    best = max(rows, key=lambda s: _norm_confidence(float(s.confidence_score or 0)))
    if _norm_confidence(float(best.confidence_score or 0)) < 0.65:
        return
    try:
        dispatch_signal_generated(db, best)
    except Exception:
        logger.exception("fanout_after_signals_persisted failed")
