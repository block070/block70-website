from __future__ import annotations

from datetime import datetime, timezone
from typing import List
from sqlalchemy.orm import Session

from app.models import Opportunity
from app.services.connectors.defillama_airdrops_connector import DefiLlamaAirdropsConnector
from app.services.pipeline.deduplication import upsert_opportunity_by_identity


def run_airdrop_pipeline(db: Session, *, limit: int = 30) -> List[Opportunity]:
    """
    Strict real-data airdrop pipeline.

    We do not use paid APIs or local fake seeds. We ingest real public airdrop
    candidate metadata from DefiLlama's open airdrop-checker dataset.

    Output is persisted into the shared Opportunity table as type='airdrop',
    deduped by (type, chain, asset_symbol, source_ref) identity, where source_ref
    is the canonical source URL.
    """
    created: List[Opportunity] = []
    now = datetime.now(timezone.utc)
    items = DefiLlamaAirdropsConnector().fetch(active_only=True)[:limit]

    for item in items:
        source_url = item.page or f"https://defillama.com/airdrops#{item.key}"
        summary_parts: list[str] = []
        if item.description:
            summary_parts.append(item.description.strip())
        if item.twitter:
            summary_parts.append(f"Twitter: @{item.twitter}")
        summary = " ".join(summary_parts)[:2000] if summary_parts else None

        opp = Opportunity(
            title=f"{item.name} airdrop candidate"[:255],
            slug=f"airdrop-{item.key}",
            type="airdrop",
            chain=None,
            status="active",
            summary=summary,
            thesis=None,
            asset_symbol=item.token_symbol,
            base_symbol=item.token_symbol,
            quote_symbol=None,
            source="DefiLlama Airdrops",
            source_ref=source_url,
            estimated_cost=None,
            estimated_upside=None,
            estimated_roi_percent=None,
            confidence_score=0.55,
            upside_score=0.35,
            freshness_score=1.0,
            liquidity_score=0.0,
            accessibility_score=0.9,
            risk_score=0.6,
            difficulty_score=0.6,
            total_score=0.55,
            risk_level="medium",
            difficulty_level="medium",
            detected_at=now,
            expires_at=None,
            last_seen_at=now,
            raw_payload={
                "defillama": {
                    "key": item.key,
                    "name": item.name,
                    "page": item.page,
                    "twitter": item.twitter,
                    "tokenSymbol": item.token_symbol,
                    "isActive": item.is_active,
                }
            },
        )

        persisted = upsert_opportunity_by_identity(db, opp)
        created.append(persisted)

    db.commit()
    return created

