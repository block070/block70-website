"""
Signal Cluster Pipeline.

Creates opportunities of type signal_cluster when multiple signals
cluster around the same token (e.g. from SignalAggregationEngine).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy.orm import Session

from app.models import Opportunity, OpportunityStatus, Signal


def run_signal_cluster_pipeline(
    db: Session,
    *,
    lookback_hours: float = 24.0,
    min_confidence: float = 0.5,
) -> List[Opportunity]:
    """
    Find aggregated signals (signal_type='aggregated') from the last
    lookback_hours. For each, create an Opportunity with type='signal_cluster'
    if one does not already exist for that token (by dedup_key).
    """
    since = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
    aggregated = (
        db.query(Signal)
        .filter(
            Signal.signal_type == "aggregated",
            Signal.created_at >= since,
            Signal.confidence_score >= min_confidence,
        )
        .order_by(Signal.created_at.desc())
        .all()
    )

    created: List[Opportunity] = []
    for sig in aggregated:
        token = (sig.token_symbol or sig.token_address or "unknown").strip()
        if not token or token == "unknown":
            continue
        dedup_key = f"signal_cluster:{token}:{sig.chain or 'any'}"
        existing = (
            db.query(Opportunity)
            .filter(
                Opportunity.dedup_key == dedup_key,
                Opportunity.status == OpportunityStatus.ACTIVE.value,
            )
            .first()
        )
        if existing:
            continue

        slug = f"signal-cluster-{token.lower().replace(' ', '-')}-{sig.id}"
        title = sig.title or f"Signal cluster: {token}"
        summary = sig.description or (
            f"Multiple signals detected for {token} "
            f"(confidence {float(sig.confidence_score or 0):.0%})."
        )

        opp = Opportunity(
            title=title,
            slug=slug,
            type="signal_cluster",
            chain=sig.chain,
            status=OpportunityStatus.ACTIVE.value,
            summary=summary,
            thesis=None,
            asset_symbol=sig.token_symbol,
            base_symbol=sig.token_symbol,
            quote_symbol=None,
            source="Signal Aggregation Engine",
            source_ref=None,
            estimated_cost=None,
            estimated_upside=(sig.confidence_score or 0.0) * 100.0,
            estimated_roi_percent=None,
            confidence_score=float(sig.confidence_score or 0.0),
            upside_score=0.0,
            freshness_score=float(sig.signal_strength or 0.0),
            liquidity_score=0.0,
            accessibility_score=0.0,
            risk_score=0.0,
            difficulty_score=0.0,
            total_score=float(sig.confidence_score or 0.0),
            risk_level=None,
            difficulty_level=None,
            detected_at=sig.created_at,
            expires_at=None,
            last_seen_at=sig.created_at,
            dedup_key=dedup_key,
            raw_payload={
                "signal_id": sig.id,
                "signal_count": (sig.metadata_json or {}).get("signal_count"),
                "signal_types": (sig.metadata_json or {}).get("signal_types"),
            },
        )
        db.add(opp)
        created.append(opp)

    if created:
        db.commit()
        for o in created:
            db.refresh(o)
    return created
