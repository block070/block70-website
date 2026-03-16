from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Opportunity,
    OpportunitySignal,
    OpportunityStatus,
    OpportunityHistory,
)
from app.schemas.opportunity import OpportunityCreate, OpportunitySignalCreate, OpportunityScores


def upsert_opportunity(
    db: Session,
    opportunity_data: OpportunityCreate,
    scores: OpportunityScores,
    signal: OpportunitySignalCreate,
) -> Opportunity:
    """
    Legacy deduplication logic used by the original Opportunity Engine
    based on a synthetic `dedup_key`.
    """
    stmt = select(Opportunity).where(
        Opportunity.dedup_key == opportunity_data.dedup_key,
        Opportunity.status == OpportunityStatus.ACTIVE.value,
    )
    existing = db.execute(stmt).scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if existing:
        existing.title = opportunity_data.title
        existing.summary = getattr(opportunity_data, "description", existing.summary)
        existing.source = opportunity_data.source
        existing.last_seen_at = now
        existing.expires_at = opportunity_data.expires_at
        existing.raw_payload = opportunity_data.raw_payload

        existing.upside_score = scores.upside_score
        existing.confidence_score = scores.confidence_score
        existing.freshness_score = scores.freshness_score
        existing.liquidity_score = scores.liquidity_score
        existing.accessibility_score = scores.accessibility_score
        existing.risk_score = scores.risk_score
        existing.difficulty_score = scores.difficulty_score
        existing.total_score = scores.total_score

        existing.risk_level = scores.risk_level
        existing.difficulty_level = scores.difficulty_level

        opportunity = existing
    else:
        opportunity = Opportunity(
            type=opportunity_data.type,
            title=opportunity_data.title,
            summary=getattr(opportunity_data, "description", None),
            source=opportunity_data.source,
            dedup_key=opportunity_data.dedup_key,
            detected_at=opportunity_data.detected_at,
            last_seen_at=opportunity_data.last_seen_at,
            expires_at=opportunity_data.expires_at,
            status=opportunity_data.status,
            raw_payload=opportunity_data.raw_payload,
            upside_score=scores.upside_score,
            confidence_score=scores.confidence_score,
            freshness_score=scores.freshness_score,
            liquidity_score=scores.liquidity_score,
            accessibility_score=scores.accessibility_score,
            risk_score=scores.risk_score,
            difficulty_score=scores.difficulty_score,
            total_score=scores.total_score,
            risk_level=scores.risk_level,
            difficulty_level=scores.difficulty_level,
        )
        db.add(opportunity)
        db.flush()

    # Record a history snapshot for this opportunity state.
    history_row = OpportunityHistory(
        opportunity_id=opportunity.id,
        score_snapshot=opportunity.total_score,
        roi_snapshot=getattr(opportunity, "estimated_roi_percent", None),
    )
    db.add(history_row)

    signal_row = OpportunitySignal(
        opportunity_id=opportunity.id,
        source=signal.source,
        signal_type=signal.signal_type,
        external_id=signal.external_id,
        payload=signal.payload,
        detected_at=signal.detected_at,
        dedup_key=signal.dedup_key,
    )
    db.add(signal_row)

    return opportunity


def deduplicate_opportunity_by_identity(
    db: Session,
    *,
    type: str,
    chain: str | None,
    asset_symbol: str | None,
    source_ref: str | None,
) -> Opportunity | None:
    """
    Find an existing ACTIVE opportunity by its natural identity:

    - type
    - chain
    - asset_symbol
    - source_ref
    """
    stmt = select(Opportunity).where(
        Opportunity.type == type,
        Opportunity.chain == chain,
        Opportunity.asset_symbol == asset_symbol,
        Opportunity.source_ref == source_ref,
        Opportunity.status == OpportunityStatus.ACTIVE.value,
    )
    return db.execute(stmt).scalar_one_or_none()


def upsert_opportunity_by_identity(
    db: Session,
    opportunity: Opportunity,
) -> Opportunity:
    """
    Deduplicate using the natural identity (type, chain, asset_symbol, source_ref).

    If an ACTIVE opportunity already exists for this identity, update its
    `last_seen_at` (and any other mutable fields as needed) instead of inserting
    a new row. Otherwise, insert the provided opportunity.
    """
    existing = deduplicate_opportunity_by_identity(
        db,
        type=opportunity.type,
        chain=opportunity.chain,
        asset_symbol=opportunity.asset_symbol,
        source_ref=opportunity.source_ref,
    )

    now = datetime.now(timezone.utc)

    if existing:
        existing.last_seen_at = now
        # Optionally refresh scores/summary from the incoming object.
        existing.summary = opportunity.summary or existing.summary
        existing.estimated_upside = opportunity.estimated_upside or existing.estimated_upside
        existing.estimated_roi_percent = (
            opportunity.estimated_roi_percent or existing.estimated_roi_percent
        )

        existing.confidence_score = opportunity.confidence_score
        existing.upside_score = opportunity.upside_score
        existing.freshness_score = opportunity.freshness_score
        existing.liquidity_score = opportunity.liquidity_score
        existing.accessibility_score = opportunity.accessibility_score
        existing.risk_score = opportunity.risk_score
        existing.difficulty_score = opportunity.difficulty_score
        existing.total_score = opportunity.total_score

        existing.risk_level = opportunity.risk_level
        existing.difficulty_level = opportunity.difficulty_level

        # History snapshot for updated opportunity.
        history_row = OpportunityHistory(
            opportunity_id=existing.id,
            score_snapshot=existing.total_score,
            roi_snapshot=existing.estimated_roi_percent,
        )
        db.add(history_row)

        return existing

    db.add(opportunity)
    db.flush()

    # History snapshot for newly inserted opportunity.
    history_row = OpportunityHistory(
        opportunity_id=opportunity.id,
        score_snapshot=opportunity.total_score,
        roi_snapshot=opportunity.estimated_roi_percent,
    )
    db.add(history_row)

    return opportunity

