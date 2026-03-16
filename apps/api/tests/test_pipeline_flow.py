"""
Unit tests for the Opportunity Engine pipeline flow (no database required).

Runs: connector -> signal extraction -> normalization -> scoring.
Validates that each stage produces valid outputs and that the full chain runs.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.services.connectors.arbitrage_mock_connector import (
    ArbitrageMockConnector,
    ArbitrageQuote,
)
from app.services.connectors.jupiter_connector import fetch_or_mock
from app.services.signals.arbitrage_signals import (
    ArbitrageSignal,
    ArbitrageSignalExtractor,
)
from app.services.pipeline.opportunity_normalizer import OpportunityNormalizer
from app.services.scoring.scoring_engine import ScoringEngine, ScoringContext


class TestPipelineFlowNoDb:
    """Full pipeline from connector through scoring, without persistence."""

    def test_connector_to_signals_to_normalize_to_score(self) -> None:
        """Connector -> extract -> normalize -> score produces valid scored opportunity data."""
        connector = ArbitrageMockConnector()
        quotes = connector.fetch_quotes()
        assert isinstance(quotes, list)
        assert all(isinstance(q, ArbitrageQuote) for q in quotes)

        extractor = ArbitrageSignalExtractor(min_net_edge_percent=0.1)
        signals = extractor.extract(quotes)
        assert isinstance(signals, list)

        normalizer = OpportunityNormalizer()
        scoring = ScoringEngine()

        scored_count = 0
        for signal in signals:
            assert isinstance(signal, ArbitrageSignal)
            op_data = normalizer.normalize_arbitrage_db(signal)
            v = signal.value
            spread_percent = float(v["spread_percent"])
            fees_percent = float(v["estimated_fees_percent"])
            net_edge_percent = max(spread_percent - fees_percent, 0.0)
            upside_score = min(max(net_edge_percent / 5.0, 0.0), 1.0)
            confidence_score = float(signal.confidence)
            liquidity_score = float(v["liquidity_score"])
            score_ctx = ScoringContext(
                upside_score=upside_score,
                confidence_score=confidence_score,
                freshness_score=1.0,
                liquidity_score=liquidity_score,
                accessibility_score=0.9,
                risk_score=1.0 - min(confidence_score, 1.0),
                difficulty_score=0.3 if liquidity_score >= 0.8 else (
                    0.6 if liquidity_score >= 0.4 else 0.8
                ),
                execution_feasibility_score=float(v.get("execution_feasibility", 0.5)),
            )
            components = scoring.score(score_ctx)
            assert 0 <= components.total_score <= 1
            assert 0 <= components.upside_score <= 1
            assert components.confidence_score >= 0
            scored_count += 1

        # When signals exist, each must be normalizable and scoreable; with low threshold
        # the mock connector often yields at least one signal (may be 0 if slippage rejects all).
        assert scored_count == len(signals)

    def test_fetch_or_mock_to_signals_chain(self) -> None:
        """fetch_or_mock -> extract produces list of signals (integration entry point)."""
        quotes = fetch_or_mock()
        assert len(quotes) > 0
        extractor = ArbitrageSignalExtractor(min_net_edge_percent=0.1)
        signals = extractor.extract(quotes)
        assert isinstance(signals, list)
        for s in signals:
            assert s.signal_type == "arbitrage_spread"
            assert "pair" in s.value and "buy_dex" in s.value and "sell_dex" in s.value
