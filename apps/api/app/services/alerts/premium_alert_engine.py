from __future__ import annotations

from typing import Any, Dict, List, Tuple

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models import AIInsight, Opportunity, PremiumAlertSubscription, Signal
from app.services.scoring.radar_event_engine import RadarEvent


class PremiumTriggeredAlert(BaseModel):
    """
    Result of evaluating premium alert subscriptions against new signals.

    These alerts are ready to be delivered to end users via whatever
    notification channels (email, push, webhook) the system supports.
    """

    user_identifier: str
    plan_type: str

    # What triggered this alert:
    metric_type: str  # "total_score" | "alpha_score" | "radar_event_score"
    metric_value: float  # 0–100 scale
    threshold: float  # 0–100 scale

    # Optional opportunity / token context
    opportunity_id: int | None = None
    opportunity_type: str | None = None
    token_symbol: str | None = None

    # Optional extra context for downstream formatting
    metadata: Dict[str, Any] = {}


def evaluate_premium_alerts(
    db: Session,
    *,
    new_opportunities: List[Opportunity],
    ranked_alpha: List[Tuple[Opportunity, float]],
    radar_events: List[RadarEvent],
    new_signals: List[Signal] | None = None,
    high_confidence_insights: List[AIInsight] | None = None,
) -> List[PremiumTriggeredAlert]:
    """
    Evaluate PremiumAlertSubscription records against:
    - newly created opportunities (total_score)
    - alpha-ranked opportunities (alpha_score)
    - aggregated RadarEvents (radar_event_score)
    - new signals (signal_alert): confidence_score or signal_strength above threshold
    - high-confidence AI insights (ai_insight_alert): AIInsight.confidence_score * 100

    and return a list of PremiumTriggeredAlert objects ready to be
    delivered to users.

    Metric semantics (all 0–100 scale in this function):
    - total_score: Opportunity.total_score * 100
    - alpha_score: alpha_score * 100 from AlphaRankingEngine
    - radar_event_score: RadarEvent.event_score * 100
    - signal_alert: Signal.confidence_score * 100 (or signal_strength * 100)
    - ai_insight_alert: AIInsight.confidence_score * 100
    """
    subs: List[PremiumAlertSubscription] = list(
        db.query(PremiumAlertSubscription)
        .order_by(PremiumAlertSubscription.created_at.asc())
        .all()
    )
    if not subs:
        return []

    results: List[PremiumTriggeredAlert] = []

    # Precompute opportunity score maps for efficiency.
    total_scores: Dict[int, float] = {
        opp.id: float(getattr(opp, "total_score", 0.0) or 0.0) * 100.0
        for opp in new_opportunities
    }

    alpha_scores: Dict[int, float] = {
        opp.id: float(alpha or 0.0) * 100.0 for (opp, alpha) in ranked_alpha
    }

    # RadarEvents are token-level; the engine maps them onto token_symbol.
    radar_scores: List[Tuple[RadarEvent, float]] = [
        (ev, float(ev.event_score or 0.0) * 100.0) for ev in radar_events
    ]

    for sub in subs:
        types = set(sub.alert_types or [])
        threshold = float(sub.minimum_score or 0)

        # 1) total_score-based alerts on new opportunities
        if "total_score" in types and new_opportunities:
            for opp in new_opportunities:
                score = total_scores.get(opp.id, 0.0)
                if score < threshold:
                    continue

                results.append(
                    PremiumTriggeredAlert(
                        user_identifier=sub.user_identifier,
                        plan_type=sub.plan_type,
                        metric_type="total_score",
                        metric_value=score,
                        threshold=threshold,
                        opportunity_id=opp.id,
                        opportunity_type=opp.type,
                        token_symbol=opp.asset_symbol or opp.base_symbol,
                        metadata={
                            "source": opp.source,
                            "title": opp.title,
                        },
                    )
                )

        # 2) alpha_score-based alerts on alpha-ranked opportunities
        if "alpha_score" in types and ranked_alpha:
            for opp, alpha in ranked_alpha:
                score = alpha_scores.get(opp.id, 0.0)
                if score < threshold:
                    continue

                results.append(
                    PremiumTriggeredAlert(
                        user_identifier=sub.user_identifier,
                        plan_type=sub.plan_type,
                        metric_type="alpha_score",
                        metric_value=score,
                        threshold=threshold,
                        opportunity_id=opp.id,
                        opportunity_type=opp.type,
                        token_symbol=opp.asset_symbol or opp.base_symbol,
                        metadata={
                            "source": opp.source,
                            "title": opp.title,
                        },
                    )
                )

        # 3) radar_event_score-based alerts on RadarEvents
        if "radar_event_score" in types and radar_scores:
            for ev, score in radar_scores:
                if score < threshold:
                    continue

                results.append(
                    PremiumTriggeredAlert(
                        user_identifier=sub.user_identifier,
                        plan_type=sub.plan_type,
                        metric_type="radar_event_score",
                        metric_value=score,
                        threshold=threshold,
                        opportunity_id=None,
                        opportunity_type="radar_event",
                        token_symbol=ev.token_symbol,
                        metadata={
                            "signal_count": ev.signal_count,
                            "signal_types": ev.signal_types,
                            "latest_signal_at": ev.latest_signal_at.isoformat(),
                        },
                    )
                )

        # 4) ai_insight_alert: high-confidence AI insights
        if "ai_insight_alert" in types and high_confidence_insights:
            for insight in high_confidence_insights:
                score = float((insight.confidence_score or 0.0) * 100.0)
                if score < threshold:
                    continue
                results.append(
                    PremiumTriggeredAlert(
                        user_identifier=sub.user_identifier,
                        plan_type=sub.plan_type,
                        metric_type="ai_insight_alert",
                        metric_value=score,
                        threshold=threshold,
                        opportunity_id=insight.id,
                        opportunity_type="ai_insight",
                        token_symbol=insight.related_tokens[0] if insight.related_tokens else None,
                        metadata={
                            "title": insight.title,
                            "summary": insight.summary,
                            "insight_type": insight.insight_type,
                        },
                    )
                )

        # 5) signal_alert: new signals exceeding confidence (or strength) threshold
        if "signal_alert" in types and new_signals:
            for sig in new_signals:
                score = float((sig.confidence_score or 0.0) * 100.0)
                if score < threshold:
                    continue
                results.append(
                    PremiumTriggeredAlert(
                        user_identifier=sub.user_identifier,
                        plan_type=sub.plan_type,
                        metric_type="signal_alert",
                        metric_value=score,
                        threshold=threshold,
                        opportunity_id=sig.id,
                        opportunity_type="signal",
                        token_symbol=sig.token_symbol,
                        metadata={
                            "signal_type": sig.signal_type,
                            "title": sig.title,
                            "source": sig.source,
                            "created_at": sig.created_at.isoformat() if sig.created_at else None,
                        },
                    )
                )

    return results

