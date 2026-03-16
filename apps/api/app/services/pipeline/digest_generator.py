from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Literal

from sqlalchemy.orm import Session
from typing_extensions import TypedDict

from app.models import Opportunity, OpportunityStatus


class DigestOpportunity(TypedDict):
    id: int
    title: str
    type: str
    chain: str | None
    asset_symbol: str | None
    total_score: float
    estimated_roi_percent: float | None
    estimated_upside: float | None
    risk_level: str | None
    difficulty_level: str | None
    summary: str | None
    source: str | None
    detected_at: str


class OpportunityDigest(TypedDict):
    generated_at: str
    arbitrage: List[DigestOpportunity]
    mining: List[DigestOpportunity]
    wallet: List[DigestOpportunity]


def _serialize_opportunity(op: Opportunity) -> DigestOpportunity:
    detected = op.detected_at or op.created_at
    detected_iso = (
        detected.astimezone(timezone.utc).isoformat()
        if detected is not None
        else datetime.now(timezone.utc).isoformat()
    )

    return {
        "id": op.id,
        "title": op.title,
        "type": op.type,
        "chain": op.chain,
        "asset_symbol": op.asset_symbol,
        "total_score": float(op.total_score or 0.0),
        "estimated_roi_percent": op.estimated_roi_percent,
        "estimated_upside": op.estimated_upside,
        "risk_level": op.risk_level,
        "difficulty_level": op.difficulty_level,
        "summary": op.summary,
        "source": op.source,
        "detected_at": detected_iso,
    }


def _top_opportunities_by_type(
    db: Session,
    opp_type: Literal["arbitrage", "mining", "wallet"],
    limit: int,
) -> List[DigestOpportunity]:
    q = (
        db.query(Opportunity)
        .filter(
            Opportunity.type == opp_type,
            Opportunity.status == OpportunityStatus.ACTIVE.value,
        )
        .order_by(Opportunity.total_score.desc())
        .limit(limit)
    )
    return [_serialize_opportunity(op) for op in q.all()]


def generate_digest(
    db: Session,
    *,
    arbitrage_limit: int = 5,
    mining_limit: int = 5,
    wallet_limit: int = 5,
) -> OpportunityDigest:
    """
    Generate a digest of top opportunities across key categories.

    The returned structure is suitable for rendering into email or Telegram
    messages by a downstream delivery layer.
    """
    generated_at = datetime.now(timezone.utc).isoformat()

    arbitrage = _top_opportunities_by_type(db, "arbitrage", arbitrage_limit)
    mining = _top_opportunities_by_type(db, "mining", mining_limit)
    wallet = _top_opportunities_by_type(db, "wallet", wallet_limit)

    digest: OpportunityDigest = {
        "generated_at": generated_at,
        "arbitrage": arbitrage,
        "mining": mining,
        "wallet": wallet,
    }
    return digest

