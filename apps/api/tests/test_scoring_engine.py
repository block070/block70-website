"""
Tests for the scoring engine (ScoringEngine).

Covers: score() output shape, total_score formula, clamping, ScoringContext.
"""
from __future__ import annotations

import pytest

from app.services.scoring.scoring_engine import (
    ScoreComponents,
    ScoringContext,
    ScoringEngine,
)


class TestScoringContext:
    """ScoringContext dataclass."""

    def test_defaults(self) -> None:
        ctx = ScoringContext(
            upside_score=0.5,
            confidence_score=0.5,
            freshness_score=0.5,
            liquidity_score=0.5,
            accessibility_score=0.5,
            risk_score=0.3,
            difficulty_score=0.3,
        )
        assert ctx.performance_score == 0.5
        assert ctx.execution_feasibility_score == 0.5


class TestScoringEngine:
    """ScoringEngine.score() and components."""

    def test_score_returns_score_components(self) -> None:
        engine = ScoringEngine()
        ctx = ScoringContext(
            upside_score=0.5,
            confidence_score=0.6,
            freshness_score=0.8,
            liquidity_score=0.7,
            accessibility_score=0.9,
            risk_score=0.3,
            difficulty_score=0.4,
        )
        out = engine.score(ctx)
        assert isinstance(out, ScoreComponents)
        assert hasattr(out, "total_score")
        assert hasattr(out, "upside_score")
        assert hasattr(out, "confidence_score")
        assert hasattr(out, "liquidity_score")
        assert hasattr(out, "execution_feasibility_score")

    def test_score_components_in_range(self) -> None:
        engine = ScoringEngine()
        ctx = ScoringContext(
            upside_score=0.8,
            confidence_score=0.7,
            freshness_score=1.0,
            liquidity_score=0.9,
            accessibility_score=0.8,
            risk_score=0.2,
            difficulty_score=0.2,
        )
        out = engine.score(ctx)
        assert 0 <= out.upside_score <= 1
        assert 0 <= out.confidence_score <= 1
        assert 0 <= out.total_score <= 1
        assert 0 <= out.risk_score <= 1
        assert 0 <= out.difficulty_score <= 1

    def test_higher_upside_higher_total(self) -> None:
        engine = ScoringEngine()
        low = engine.score(
            ScoringContext(
                upside_score=0.2,
                confidence_score=0.5,
                freshness_score=0.5,
                liquidity_score=0.5,
                accessibility_score=0.5,
                risk_score=0.5,
                difficulty_score=0.5,
            )
        )
        high = engine.score(
            ScoringContext(
                upside_score=0.9,
                confidence_score=0.5,
                freshness_score=0.5,
                liquidity_score=0.5,
                accessibility_score=0.5,
                risk_score=0.5,
                difficulty_score=0.5,
            )
        )
        assert high.total_score > low.total_score

    def test_higher_risk_lower_total(self) -> None:
        engine = ScoringEngine()
        low_risk = engine.score(
            ScoringContext(
                upside_score=0.5,
                confidence_score=0.5,
                freshness_score=0.5,
                liquidity_score=0.5,
                accessibility_score=0.5,
                risk_score=0.1,
                difficulty_score=0.3,
            )
        )
        high_risk = engine.score(
            ScoringContext(
                upside_score=0.5,
                confidence_score=0.5,
                freshness_score=0.5,
                liquidity_score=0.5,
                accessibility_score=0.5,
                risk_score=0.9,
                difficulty_score=0.3,
            )
        )
        assert low_risk.total_score > high_risk.total_score

    def test_clamp_extreme_inputs(self) -> None:
        engine = ScoringEngine()
        ctx = ScoringContext(
            upside_score=2.0,
            confidence_score=-0.5,
            freshness_score=1.5,
            liquidity_score=0.5,
            accessibility_score=0.5,
            risk_score=0.5,
            difficulty_score=0.5,
        )
        out = engine.score(ctx)
        assert 0 <= out.upside_score <= 1
        assert 0 <= out.confidence_score <= 1
        assert 0 <= out.total_score <= 1

    def test_performance_score_default_integration(self) -> None:
        """When performance_score and execution_feasibility are default, total is still valid."""
        engine = ScoringEngine()
        ctx = ScoringContext(
            upside_score=0.6,
            confidence_score=0.6,
            freshness_score=0.7,
            liquidity_score=0.6,
            accessibility_score=0.8,
            risk_score=0.4,
            difficulty_score=0.4,
        )
        out = engine.score(ctx)
        assert out.performance_score == 0.5
        assert out.total_score > 0
