"""
Tests for deduplication (upsert_opportunity_by_identity, deduplicate_opportunity_by_identity).

Unit tests (identity consistency) run without DB; insert/update tests require database
and are skipped when DATABASE_URL is not set.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.models import Opportunity
from app.services.pipeline.deduplication import (
    deduplicate_opportunity_by_identity,
    upsert_opportunity_by_identity,
)


class TestDeduplicationIdentity:
    """Deduplication identity (type, chain, asset_symbol, source_ref) — no DB required."""

    def test_identity_fields_defined_on_opportunity(self) -> None:
        """Opportunity has the four identity fields used by deduplicate_opportunity_by_identity."""
        opp = _make_opportunity(
            type="arbitrage",
            chain=None,
            asset_symbol="SOL",
            source_ref="SOL/USDC:Raydium->Orca",
        )
        assert opp.type == "arbitrage"
        assert opp.chain is None
        assert opp.asset_symbol == "SOL"
        assert opp.source_ref == "SOL/USDC:Raydium->Orca"

    def test_different_source_ref_different_identity(self) -> None:
        """Different source_ref implies different logical identity."""
        opp1 = _make_opportunity(source_ref="SOL/USDC:Raydium->Orca", slug="s1")
        opp2 = _make_opportunity(source_ref="SOL/USDC:Orca->Raydium", slug="s2")
        assert opp1.source_ref != opp2.source_ref
        assert opp1.type == opp2.type and opp1.asset_symbol == opp2.asset_symbol


def _make_opportunity(
    *,
    type: str = "arbitrage",
    chain: str | None = None,
    asset_symbol: str | None = "SOL",
    source_ref: str | None = "SOL/USDC:Raydium->Orca",
    title: str = "Test arbitrage",
    slug: str = "test-arb-sol-1",
) -> Opportunity:
    now = datetime.now(timezone.utc)
    return Opportunity(
        title=title,
        slug=slug,
        type=type,
        chain=chain,
        status="active",
        summary="Test summary",
        thesis=None,
        asset_symbol=asset_symbol,
        base_symbol=asset_symbol,
        quote_symbol="USDC",
        source="test",
        source_ref=source_ref,
        estimated_cost=None,
        estimated_upside=1.5,
        estimated_roi_percent=1.5,
        confidence_score=0.7,
        upside_score=0.6,
        freshness_score=0.8,
        liquidity_score=0.7,
        accessibility_score=0.9,
        risk_score=0.3,
        difficulty_score=0.4,
        total_score=0.65,
        risk_level="medium",
        difficulty_level="medium",
        detected_at=now,
        expires_at=None,
        last_seen_at=now,
        dedup_key=None,
        raw_payload=None,
    )


class TestDeduplicateOpportunityByIdentity:
    """deduplicate_opportunity_by_identity lookup."""

    def test_returns_none_when_empty_db(self, db_session) -> None:
        existing = deduplicate_opportunity_by_identity(
            db_session,
            type="arbitrage",
            chain=None,
            asset_symbol="SOL",
            source_ref="SOL/USDC:Raydium->Orca",
        )
        assert existing is None

    def test_finds_existing_after_insert(self, db_session) -> None:
        opp = _make_opportunity(slug="dedup-test-sol-1")
        db_session.add(opp)
        db_session.flush()

        existing = deduplicate_opportunity_by_identity(
            db_session,
            type="arbitrage",
            chain=None,
            asset_symbol="SOL",
            source_ref="SOL/USDC:Raydium->Orca",
        )
        assert existing is not None
        assert existing.id == opp.id


class TestUpsertOpportunityByIdentity:
    """upsert_opportunity_by_identity insert and update."""

    def test_insert_when_no_existing(self, db_session) -> None:
        opp = _make_opportunity(slug="upsert-new-1")
        result = upsert_opportunity_by_identity(db_session, opp)
        db_session.flush()
        assert result.id is not None
        assert result.title == "Test arbitrage"

    def test_update_when_identity_matches(self, db_session) -> None:
        opp1 = _make_opportunity(title="First", slug="upsert-match-1")
        db_session.add(opp1)
        db_session.flush()
        first_id = opp1.id

        opp2 = _make_opportunity(title="Second", slug="upsert-match-2")
        opp2.type = opp1.type
        opp2.chain = opp1.chain
        opp2.asset_symbol = opp1.asset_symbol
        opp2.source_ref = opp1.source_ref

        result = upsert_opportunity_by_identity(db_session, opp2)
        db_session.flush()
        assert result.id == first_id
        # Identity match: returns existing row (title unchanged in upsert)
        assert result.title == "First"
        assert result.last_seen_at is not None
