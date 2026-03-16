from __future__ import annotations

from typing import Any, Dict, List, Tuple

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models import Alert, Opportunity, Signal
from app.services.scoring.radar_event_engine import RadarEvent


class TriggeredAlert(BaseModel):
    """
    Result of evaluating an alert against a new opportunity.
    """

    alert_id: int
    alert_name: str
    user_identifier: str
    type: str
    conditions: Dict[str, Any]

    opportunity_id: int
    opportunity_type: str
    opportunity_total_score: float
    alpha_score: float | None = None


def _matches_conditions(alert: Alert, opportunity: Opportunity) -> bool:
    """
    Simple condition matcher for alerts.

    Supported condition keys (all optional):
    - type: exact match on opportunity.type
    - min_score: minimum total_score expressed as a whole-number percentage (e.g. 85)
    """
    conditions = alert.conditions_json or {}

    cond_type = conditions.get("type")
    if cond_type and opportunity.type != cond_type:
        return False

    min_score = conditions.get("min_score")
    if isinstance(min_score, (int, float)):
        # Alerts use 0–100 scale; total_score is 0–1.
        if (opportunity.total_score or 0.0) * 100 < float(min_score):
            return False

    return True


def evaluate_alerts(
    db: Session,
    new_opportunities: List[Opportunity],
) -> List[TriggeredAlert]:
    """
    Evaluate active alerts against a batch of newly created opportunities.

    This function does not send notifications. It simply returns a list of
    TriggeredAlert objects describing which alerts fired for which opportunities.
    """
    if not new_opportunities:
        return []

    active_alerts: List[Alert] = (
        db.query(Alert).filter(Alert.is_active.is_(True)).order_by(Alert.created_at.asc()).all()
    )

    results: List[TriggeredAlert] = []

    for alert in active_alerts:
        for opp in new_opportunities:
            if _matches_conditions(alert, opp):
                results.append(
                    TriggeredAlert(
                        alert_id=alert.id,
                        alert_name=alert.name,
                        user_identifier=alert.user_identifier,
                        type=alert.type,
                        conditions=alert.conditions_json or {},
                        opportunity_id=opp.id,
                        opportunity_type=opp.type,
                        opportunity_total_score=opp.total_score,
                    )
                )

    return results


def evaluate_alpha_alerts(
    db: Session,
    ranked_opportunities: List[Tuple[Opportunity, float]],
) -> List[TriggeredAlert]:
    """
    Evaluate alpha_alert type alerts against a ranked list of opportunities.

    Conditions for alpha_alert (conditions_json):
    - min_alpha_score: minimum alpha_score threshold (0–100 scale)
    - only_top: if true, evaluate only the top-ranked opportunity
    """
    if not ranked_opportunities:
        return []

    active_alerts: List[Alert] = (
        db.query(Alert)
        .filter(Alert.is_active.is_(True), Alert.type == "alpha_alert")
        .order_by(Alert.created_at.asc())
        .all()
    )

    results: List[TriggeredAlert] = []

    for alert in active_alerts:
        conditions = alert.conditions_json or {}
        min_alpha_score = conditions.get("min_alpha_score")
        only_top = bool(conditions.get("only_top", True))

        candidates = (
            ranked_opportunities[:1] if only_top else ranked_opportunities
        )

        for opp, alpha in candidates:
            if isinstance(min_alpha_score, (int, float)) and alpha * 100 < float(
                min_alpha_score
            ):
                continue

            results.append(
                TriggeredAlert(
                    alert_id=alert.id,
                    alert_name=alert.name,
                    user_identifier=alert.user_identifier,
                    type=alert.type,
                    conditions=conditions,
                    opportunity_id=opp.id,
                    opportunity_type=opp.type,
                    opportunity_total_score=opp.total_score,
                    alpha_score=alpha,
                )
            )

    return results


def evaluate_radar_alerts(
    db: Session,
    radar_events: List[RadarEvent],
) -> List[TriggeredAlert]:
    """
    Evaluate radar_event type alerts against a list of aggregated RadarEvents.

    Conditions for radar_event (conditions_json):
    - min_event_score: minimum event_score threshold (0–100 scale)
    - token_symbol: optional filter to a specific token symbol
    """
    if not radar_events:
        return []

    active_alerts: List[Alert] = (
        db.query(Alert)
        .filter(Alert.is_active.is_(True), Alert.type == "radar_event")
        .order_by(Alert.created_at.asc())
        .all()
    )

    results: List[TriggeredAlert] = []

    for alert in active_alerts:
        conditions = alert.conditions_json or {}
        min_event_score = conditions.get("min_event_score")
        target_token = (
            str(conditions.get("token_symbol")).upper()
            if conditions.get("token_symbol")
            else None
        )

        for ev in radar_events:
            if target_token and ev.token_symbol.upper() != target_token:
                continue

            if isinstance(min_event_score, (int, float)) and ev.event_score * 100 < float(
                min_event_score
            ):
                continue

            # Map RadarEvent onto an opportunity-like alert for downstream handling.
            results.append(
                TriggeredAlert(
                    alert_id=alert.id,
                    alert_name=alert.name,
                    user_identifier=alert.user_identifier,
                    type=alert.type,
                    conditions=conditions,
                    opportunity_id=0,  # no single opportunity; this is a token-level radar event
                    opportunity_type="radar_event",
                    opportunity_total_score=ev.event_score,
                    alpha_score=None,
                )
            )

    return results


def evaluate_signal_alerts(
    db: Session,
    new_signals: List[Signal],
) -> List[TriggeredAlert]:
    """
    Evaluate signal_alert type alerts against new signals.

    Conditions for signal_alert (conditions_json):
    - min_confidence: minimum confidence_score threshold (0–100 scale)
    - token_symbol: optional filter to a specific token
    - signal_type: optional filter to a specific signal_type
    """
    if not new_signals:
        return []

    active_alerts: List[Alert] = (
        db.query(Alert)
        .filter(Alert.is_active.is_(True), Alert.type == "signal_alert")
        .order_by(Alert.created_at.asc())
        .all()
    )

    results: List[TriggeredAlert] = []

    for alert in active_alerts:
        conditions = alert.conditions_json or {}
        min_confidence = conditions.get("min_confidence")
        target_token = (
            str(conditions.get("token_symbol")).strip().upper()
            if conditions.get("token_symbol")
            else None
        )
        target_signal_type = conditions.get("signal_type")

        for sig in new_signals:
            if target_token:
                sym = (sig.token_symbol or "").strip().upper()
                addr = (sig.token_address or "").strip()
                if sym != target_token and addr.upper() != target_token:
                    continue
            if target_signal_type and sig.signal_type != target_signal_type:
                continue
            conf_100 = (sig.confidence_score or 0.0) * 100.0
            if isinstance(min_confidence, (int, float)) and conf_100 < float(min_confidence):
                continue

            results.append(
                TriggeredAlert(
                    alert_id=alert.id,
                    alert_name=alert.name,
                    user_identifier=alert.user_identifier,
                    type=alert.type,
                    conditions=conditions,
                    opportunity_id=sig.id,
                    opportunity_type="signal",
                    opportunity_total_score=sig.confidence_score or 0.0,
                    alpha_score=None,
                )
            )

    return results

