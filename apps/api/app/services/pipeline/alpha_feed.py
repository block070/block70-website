from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models import AlphaEvent, Opportunity


def _derive_event_type(opportunity: Opportunity) -> str:
    """
    Map an Opportunity into a high-level alpha event type.
    """
    if opportunity.type == "arbitrage":
        return "arbitrage_detected"
    if opportunity.type == "wallet":
        # Wallet opportunities generally correspond to high-signal buys / accumulation.
        return "whale_buy"
    if opportunity.type == "mining":
        return "miner_roi_spike"

    return "trend_signal"


def _build_summary(opportunity: Opportunity) -> str:
    """
    Build a short, human-readable summary suitable for the alpha feed.
    """
    token = opportunity.asset_symbol or opportunity.base_symbol or "Unknown"

    if opportunity.type == "wallet":
        notional = opportunity.estimated_upside or 0.0
        if notional <= 0 and opportunity.estimated_cost:
            notional = opportunity.estimated_cost
        if notional > 0:
            return f"Whale wallet activity on {token}: ~${notional:,.0f} notional move"
        return f"Whale wallet activity detected on {token}"

    if opportunity.type == "arbitrage":
        edge = opportunity.estimated_roi_percent
        if edge is not None:
            return f"Arbitrage detected on {token}: ~{edge:.2f}% net edge available"
        return f"Arbitrage opportunity detected on {token}"

    if opportunity.type == "mining":
        roi = opportunity.estimated_roi_percent
        if roi is not None:
            return f"Miner ROI spike for {token}: ~{roi:.1f}% annualized ROI"
        return f"Miner ROI change detected for {token}"

    # Fallback to the opportunity title/summary if type-specific formatting is not available.
    return opportunity.title or (opportunity.summary or "New alpha event detected")


def emit_alpha_event_for_opportunity(
    db: Session,
    opportunity: Opportunity,
    *,
    event_type: Optional[str] = None,
) -> AlphaEvent:
    """
    Create and persist an AlphaEvent for a newly detected opportunity.

    This helper is intended to be called from within opportunity pipelines
    after an Opportunity has been persisted / upserted.
    """
    etype = event_type or _derive_event_type(opportunity)
    summary = _build_summary(opportunity)

    event = AlphaEvent(
        event_type=etype,
        token_symbol=opportunity.asset_symbol,
        chain=opportunity.chain,
        summary=summary,
        confidence_score=opportunity.confidence_score,
        source=opportunity.source,
    )
    db.add(event)
    # The surrounding pipeline is responsible for committing.
    return event

