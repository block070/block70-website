from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from sqlalchemy.orm import Session

from app.models import Opportunity, UserStrategy
from app.services.scoring.radar_event_engine import RadarEvent


@dataclass
class StrategyContext:
    """
    Inputs available when evaluating a strategy.

    This keeps the engine decoupled from specific pipeline implementations
    while still allowing it to consume wallet and radar signals alongside
    new opportunities.
    """

    # Newly created or updated opportunities to test against.
    opportunities: Sequence[Opportunity]
    # Wallet-related signals keyed by opportunity.id (if available).
    wallet_signals: Mapping[int, Sequence[Dict[str, Any]]]
    # Aggregated radar events keyed by token symbol (uppercased).
    radar_events_by_token: Mapping[str, Sequence[RadarEvent]]


@dataclass
class TriggeredStrategyAlert:
    """
    Result of evaluating a UserStrategy against an opportunity.
    """

    strategy_id: int
    user_identifier: str
    strategy_name: str

    opportunity_id: int
    opportunity_type: str
    token_symbol: Optional[str]
    total_score: float
    estimated_roi_percent: Optional[float]

    # Optional context for downstream formatting / delivery.
    metadata: Dict[str, Any]


def _normalize_conditions(raw: Any) -> Dict[str, Any]:
    """
    Ensure conditions are a dict. UserStrategy.conditions_json is stored as a
    JSON-like structure via the ORM; at runtime it should already be a dict,
    but we guard against None / unexpected types for robustness.
    """
    if isinstance(raw, dict):
        return raw
    return {}


def _opportunity_matches_strategy(
    *,
    strategy: UserStrategy,
    opportunity: Opportunity,
    ctx: StrategyContext,
) -> bool:
    """
    Check whether a single opportunity satisfies the given UserStrategy.

    Supported condition keys (all optional):
    - min_score: minimum total_score on 0–100 scale
    - min_roi: minimum estimated_roi_percent
    - type: exact match on opportunity.type
    - wallet_signal_types: list of wallet signal types that must be present
    - radar_min_score: minimum RadarEvent.event_score (0–100) for the token
    """
    conditions = _normalize_conditions(strategy.conditions_json)

    # 1) Score threshold
    min_score = conditions.get("min_score")
    if isinstance(min_score, (int, float)):
        if (opportunity.total_score or 0.0) * 100 < float(min_score):
            return False

    # 2) ROI threshold
    min_roi = conditions.get("min_roi")
    if isinstance(min_roi, (int, float)):
        roi = opportunity.estimated_roi_percent
        if roi is None or float(roi) < float(min_roi):
            return False

    # 3) Opportunity type filter
    cond_type = conditions.get("type")
    if cond_type and opportunity.type != cond_type:
        return False

    # 4) Wallet signal requirements
    required_wallet_types: Iterable[str] = conditions.get("wallet_signal_types") or []
    if required_wallet_types:
        wallet_for_opp = ctx.wallet_signals.get(opportunity.id, ())
        existing_types = {str(s.get("signal_type")) for s in wallet_for_opp}
        for required in required_wallet_types:
            if required not in existing_types:
                return False

    # 5) Radar signal strength requirements
    radar_min_score = conditions.get("radar_min_score")
    if isinstance(radar_min_score, (int, float)):
        token = (opportunity.asset_symbol or opportunity.base_symbol or "").upper()
        if token:
            events = ctx.radar_events_by_token.get(token, ())
            max_event_score = max(
                (float(ev.event_score or 0.0) * 100.0 for ev in events),
                default=0.0,
            )
            if max_event_score < float(radar_min_score):
                return False

    return True


def evaluate_user_strategies(
    db: Session,
    *,
    context: StrategyContext,
) -> List[TriggeredStrategyAlert]:
    """
    Evaluate all stored UserStrategy records against a batch of opportunities.

    This engine is intentionally similar to the generic alert and premium
    alert evaluators, but focused on user-defined strategies that can combine:

    - score thresholds
    - ROI thresholds
    - wallet signals
    - radar signals
    - opportunity type
    """
    if not context.opportunities:
        return []

    strategies: List[UserStrategy] = list(
        db.query(UserStrategy).order_by(UserStrategy.created_at.asc()).all()
    )
    if not strategies:
        return []

    results: List[TriggeredStrategyAlert] = []

    for strat in strategies:
        for opp in context.opportunities:
            if not _opportunity_matches_strategy(
                strategy=strat,
                opportunity=opp,
                ctx=context,
            ):
                continue

            results.append(
                TriggeredStrategyAlert(
                    strategy_id=strat.id,
                    user_identifier=strat.user_identifier,
                    strategy_name=strat.strategy_name,
                    opportunity_id=opp.id,
                    opportunity_type=opp.type,
                    token_symbol=opp.asset_symbol or opp.base_symbol,
                    total_score=opp.total_score,
                    estimated_roi_percent=opp.estimated_roi_percent,
                    metadata={
                        "conditions": _normalize_conditions(strat.conditions_json),
                        "source": opp.source,
                        "title": opp.title,
                    },
                )
            )

    return results

