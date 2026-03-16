"""
Integration tests for the Opportunity Pipeline (run_arbitrage).

Runs the full flow: connector -> signals -> normalization -> scoring -> deduplication -> persist.
Requires database; skipped when DATABASE_URL is not set.
"""
from __future__ import annotations

import pytest

from app.services.pipeline.opportunity_pipeline import OpportunityPipeline


class TestOpportunityPipelineRunArbitrage:
    """OpportunityPipeline.run_arbitrage full flow."""

    def test_run_arbitrage_returns_list(self, db_session) -> None:
        pipeline = OpportunityPipeline()
        results = pipeline.run_arbitrage(db_session)
        assert isinstance(results, list)

    def test_run_arbitrage_elements_are_opportunities(self, db_session) -> None:
        pipeline = OpportunityPipeline()
        results = pipeline.run_arbitrage(db_session)
        from app.models import Opportunity

        for opp in results:
            assert isinstance(opp, Opportunity)
            assert opp.id is not None
            assert opp.type == "arbitrage"
            assert opp.status == "active"

    def test_run_arbitrage_idempotent_second_run_updates_not_duplicates(self, db_session) -> None:
        pipeline = OpportunityPipeline()
        first = pipeline.run_arbitrage(db_session)
        second = pipeline.run_arbitrage(db_session)
        # Second run should not double the number of opportunities (dedup by identity).
        assert len(second) == len(first)
