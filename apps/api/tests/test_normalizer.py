"""
Tests for opportunity normalization (OpportunityNormalizer).

Covers: normalize_arbitrage_db output shape and derived fields.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.services.pipeline.opportunity_normalizer import OpportunityNormalizer
from app.services.signals.arbitrage_signals import ArbitrageSignal


def _arbitrage_signal(
    pair: str = "SOL/USDC",
    buy_dex: str = "Raydium",
    sell_dex: str = "Orca",
    spread_percent: float = 1.5,
    fees_percent: float = 0.4,
    liquidity_score: float = 0.8,
    entity_id: str | None = None,
) -> ArbitrageSignal:
    now = datetime.now(timezone.utc)
    return ArbitrageSignal(
        signal_type="arbitrage_spread",
        entity_id=entity_id or f"{pair}:{buy_dex}->{sell_dex}",
        value={
            "pair": pair,
            "buy_dex": buy_dex,
            "sell_dex": sell_dex,
            "buy_price": 174.0,
            "sell_price": 176.0,
            "spread_percent": spread_percent,
            "estimated_slippage_percent": 0.2,
            "estimated_fees_percent": fees_percent,
            "liquidity_score": liquidity_score,
            "min_liquidity_usd": 800_000.0,
            "execution_feasibility": 0.85,
            "effective_price": 174.35,
        },
        confidence=0.75,
        timestamp=now,
    )


class TestOpportunityNormalizerArbitrageDb:
    """OpportunityNormalizer.normalize_arbitrage_db."""

    def test_returns_db_opportunity_create(self) -> None:
        normalizer = OpportunityNormalizer()
        signal = _arbitrage_signal()
        op = normalizer.normalize_arbitrage_db(signal)
        assert op is not None
        assert op.title
        assert op.slug
        assert op.type == "arbitrage"
        assert op.status == "active"

    def test_title_contains_pair_and_dexes(self) -> None:
        normalizer = OpportunityNormalizer()
        signal = _arbitrage_signal(pair="BONK/USDC", buy_dex="Jupiter", sell_dex="Raydium")
        op = normalizer.normalize_arbitrage_db(signal)
        assert "BONK/USDC" in op.title
        assert "Jupiter" in op.title
        assert "Raydium" in op.title

    def test_slug_format(self) -> None:
        normalizer = OpportunityNormalizer()
        signal = _arbitrage_signal(pair="SOL/USDC", buy_dex="Raydium", sell_dex="Orca")
        op = normalizer.normalize_arbitrage_db(signal)
        assert op.slug.startswith("arbitrage-")
        assert "sol-usdc" in op.slug

    def test_asset_and_base_quote_symbols(self) -> None:
        normalizer = OpportunityNormalizer()
        signal = _arbitrage_signal(pair="JUP/USDC")
        op = normalizer.normalize_arbitrage_db(signal)
        assert op.asset_symbol == "JUP"
        assert op.base_symbol == "JUP"
        assert op.quote_symbol == "USDC"

    def test_source_ref_from_entity_id(self) -> None:
        normalizer = OpportunityNormalizer()
        signal = _arbitrage_signal(entity_id="SOL/USDC:Raydium->Orca")
        op = normalizer.normalize_arbitrage_db(signal)
        assert op.source_ref == "SOL/USDC:Raydium->Orca"

    def test_estimated_roi_and_upside(self) -> None:
        normalizer = OpportunityNormalizer()
        signal = _arbitrage_signal(spread_percent=2.0, fees_percent=0.4)
        op = normalizer.normalize_arbitrage_db(signal)
        assert op.estimated_roi_percent is not None
        assert op.estimated_roi_percent == pytest.approx(1.6, abs=0.01)
        assert op.estimated_upside is not None

    def test_risk_level_by_net_edge(self) -> None:
        normalizer = OpportunityNormalizer()
        low_edge = _arbitrage_signal(spread_percent=0.6, fees_percent=0.4)
        mid_edge = _arbitrage_signal(spread_percent=1.2, fees_percent=0.4)
        high_edge = _arbitrage_signal(spread_percent=3.0, fees_percent=0.4)
        assert normalizer.normalize_arbitrage_db(low_edge).risk_level == "high"
        assert normalizer.normalize_arbitrage_db(mid_edge).risk_level == "medium"
        assert normalizer.normalize_arbitrage_db(high_edge).risk_level == "low"

    def test_difficulty_level_by_liquidity(self) -> None:
        normalizer = OpportunityNormalizer()
        easy = _arbitrage_signal(liquidity_score=0.9)
        medium = _arbitrage_signal(liquidity_score=0.5)
        hard = _arbitrage_signal(liquidity_score=0.2)
        assert normalizer.normalize_arbitrage_db(easy).difficulty_level == "easy"
        assert normalizer.normalize_arbitrage_db(medium).difficulty_level == "medium"
        assert normalizer.normalize_arbitrage_db(hard).difficulty_level == "hard"

    def test_scores_in_valid_range(self) -> None:
        normalizer = OpportunityNormalizer()
        signal = _arbitrage_signal()
        op = normalizer.normalize_arbitrage_db(signal)
        assert 0 <= op.confidence_score <= 1
        assert 0 <= op.upside_score <= 1
        assert 0 <= op.total_score <= 1
        assert 0 <= op.liquidity_score <= 1
