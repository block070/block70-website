"""
Strategy engine: evaluate TradingStrategy against signals and market data.

Steps:
1. Load signals
2. Apply strategy conditions
3. Detect entry points
4. Detect exit points
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import Signal, TradingStrategy, StrategyCondition


@dataclass
class EntryPoint:
    token_symbol: str
    signal_id: int
    score: float
    metadata: Dict[str, Any]


@dataclass
class ExitPoint:
    token_symbol: str
    reason: str  # e.g. "take_profit", "stop_loss", "signal_exit"
    metadata: Dict[str, Any]


def _normalize_conditions_json(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}
    return {}


def _conditions_from_rows(rows: List[StrategyCondition]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for r in rows:
        key = r.condition_type
        try:
            out[key] = json.loads(r.condition_value) if r.condition_value else None
        except (TypeError, json.JSONDecodeError):
            out[key] = r.condition_value
    return out


class StrategyEngine:
    """
    Evaluate TradingStrategy against signals and market data.
    """

    def load_signals(
        self,
        db: Session,
        *,
        chain: Optional[str] = None,
        signal_type: Optional[str] = None,
        limit: int = 200,
    ) -> List[Signal]:
        q = db.query(Signal).order_by(Signal.created_at.desc())
        if chain:
            q = q.filter(Signal.chain == chain)
        if signal_type:
            q = q.filter(Signal.signal_type == signal_type)
        return q.limit(limit).all()

    def apply_conditions(
        self,
        strategy: TradingStrategy,
        signal: Signal,
        conditions_cache: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Return True if the signal satisfies the strategy's conditions.
        Uses conditions_json and StrategyCondition rows.
        """
        conditions = _normalize_conditions_json(strategy.conditions_json)
        if conditions_cache is not None:
            conditions = {**conditions, **conditions_cache}

        min_strength = conditions.get("min_signal_strength")
        if min_strength is not None:
            if (signal.signal_strength or 0) < float(min_strength):
                return False

        min_confidence = conditions.get("min_confidence")
        if min_confidence is not None:
            if (signal.confidence_score or 0) < float(min_confidence):
                return False

        allowed_types = conditions.get("signal_types")
        if allowed_types and isinstance(allowed_types, list):
            if signal.signal_type not in allowed_types:
                return False

        return True

    def detect_entry_points(
        self,
        db: Session,
        strategy: TradingStrategy,
        signals: Optional[List[Signal]] = None,
    ) -> List[EntryPoint]:
        """
        From signals (or load from DB), apply strategy conditions and return entry points.
        """
        if signals is None:
            signals = self.load_signals(db, limit=500)

        condition_rows = (
            db.query(StrategyCondition)
            .filter(StrategyCondition.strategy_id == strategy.id)
            .all()
        )
        conditions_cache = _conditions_from_rows(condition_rows)

        entries: List[EntryPoint] = []
        for s in signals:
            if not self.apply_conditions(strategy, s, conditions_cache):
                continue
            token = (s.token_symbol or s.token_address or "").strip() or "UNKNOWN"
            entries.append(
                EntryPoint(
                    token_symbol=token,
                    signal_id=s.id,
                    score=float(s.confidence_score or 0),
                    metadata={"signal_type": s.signal_type},
                )
            )
        return entries

    def detect_exit_points(
        self,
        strategy: TradingStrategy,
        entry_points: List[EntryPoint],
        exit_reasons: Optional[Dict[str, str]] = None,
    ) -> List[ExitPoint]:
        """
        Placeholder: derive exit points from entry points and strategy exit_rules.
        In a full implementation this would use price/market data and exit rules.
        """
        exits: List[ExitPoint] = []
        for e in entry_points:
            exits.append(
                ExitPoint(
                    token_symbol=e.token_symbol,
                    reason=(exit_reasons or {}).get(e.token_symbol, "signal_exit"),
                    metadata={},
                )
            )
        return exits


strategy_engine = StrategyEngine()
