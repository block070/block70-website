from __future__ import annotations

from typing import List

from sqlalchemy.orm import Session

from app.models import Opportunity
from app.services.connectors.airdrops_connector import AirdropsConnector
from app.services.connectors.defillama_airdrops_connector import (
    DefiLlamaAirdropsConnector,
)
from app.services.pipeline.deduplication import upsert_opportunity_by_identity


def run_airdrop_pipeline(db: Session, *, limit: int = 30) -> List[Opportunity]:
    """
    Strict real-data airdrop pipeline.

    We do not use paid APIs or local fake seeds. We ingest real public airdrop
    candidate metadata from DefiLlama's open airdrop-checker dataset.

    Output is persisted into the shared Opportunity table as type='airdrop',
    deduped by (type, chain, asset_symbol, source_ref) identity, where
    source_ref is the canonical source URL (for web sources).
    """
    created: List[Opportunity] = []

    # 1) DefiLlama open dataset (existing source).
    llama_items = DefiLlamaAirdropsConnector().fetch(active_only=True)[:limit]
    for item in llama_items:
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
            detected_at=None,
            expires_at=None,
            last_seen_at=None,
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

    # 2) Web connectors: Airdrops.io, DappRadar, ICO Drops.
    external_items = AirdropsConnector().fetch_all(limit=limit)
    for item in external_items:
        # Map normalized external record into Opportunity fields.
        status = item.status if item.status in {"active", "upcoming"} else "expired"
        if status == "expired":
            # Skip clearly expired campaigns for the main feed.
            continue

        title = f"{item.project_name} airdrop"
        summary = item.description[:2000] if item.description else None
        difficulty_level = (item.difficulty or "").lower() or None

        # Simple scoring heuristics: reward_estimate and difficulty influence upside/risk.
        reward = float(item.reward_estimate) if item.reward_estimate is not None else None
        if reward is not None:
            # Normalize very roughly: treat $10-500 range as 0-1 upside score band.
            upside_score = max(0.1, min(reward / 500.0, 1.0))
        else:
            upside_score = 0.4

        if difficulty_level == "low":
            difficulty_score = 0.3
            risk_level = "low"
        elif difficulty_level == "high":
            difficulty_score = 0.8
            risk_level = "high"
        else:
            difficulty_score = 0.5
            risk_level = "medium"

        confidence_score = 0.6
        freshness_score = 0.9
        accessibility_score = 0.8
        risk_score = 0.6 if risk_level == "high" else 0.4
        total_score = (upside_score + freshness_score + accessibility_score) / 3.0

        opp = Opportunity(
            title=title[:255],
            slug=f"airdrop-{item.source.lower().replace(' ', '-')}-{item.project_name.lower().replace(' ', '-')}",
            type="airdrop",
            chain=item.chain,
            status="active" if status == "active" else "upcoming",
            summary=summary,
            thesis=None,
            asset_symbol=None,
            base_symbol=None,
            quote_symbol=None,
            source=item.source,
            source_ref=item.source_url,
            estimated_cost=None,
            estimated_upside=reward,
            estimated_roi_percent=None,
            confidence_score=confidence_score,
            upside_score=upside_score,
            freshness_score=freshness_score,
            liquidity_score=0.0,
            accessibility_score=accessibility_score,
            risk_score=risk_score,
            difficulty_score=difficulty_score,
            total_score=total_score,
            risk_level=risk_level,
            difficulty_level=difficulty_level,
            detected_at=item.timestamp,
            expires_at=None,
            last_seen_at=item.timestamp,
            raw_payload={
                "external_airdrop": {
                    "project_name": item.project_name,
                    "chain": item.chain,
                    "status": item.status,
                    "source": item.source,
                    "source_url": item.source_url,
                }
            },
        )

        persisted = upsert_opportunity_by_identity(db, opp)
        created.append(persisted)

    db.commit()
    return created

