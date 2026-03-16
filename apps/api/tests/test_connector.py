"""
Tests for the Opportunity Engine connector layer.

Covers: ArbitrageMockConnector output shape, fetch_or_mock fallback behavior.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.services.connectors.arbitrage_mock_connector import (
    ArbitrageMockConnector,
    ArbitrageQuote,
)
from app.services.connectors.jupiter_connector import fetch_or_mock


class TestArbitrageQuote:
    """ArbitrageQuote model and validation."""

    def test_quote_has_required_fields(self) -> None:
        now = datetime.now(timezone.utc)
        q = ArbitrageQuote(
            dex="Jupiter",
            pair="SOL/USDC",
            price=175.0,
            liquidity=1_000_000.0,
            timestamp=now,
        )
        assert q.dex == "Jupiter"
        assert q.pair == "SOL/USDC"
        assert q.price == 175.0
        assert q.liquidity == 1_000_000.0
        assert q.timestamp == now
        assert q.route is None

    def test_quote_optional_route(self) -> None:
        now = datetime.now(timezone.utc)
        q = ArbitrageQuote(
            dex="Jupiter",
            pair="SOL/USDC",
            price=175.0,
            liquidity=1_000_000.0,
            timestamp=now,
            route="Raydium -> Orca",
        )
        assert q.route == "Raydium -> Orca"


class TestArbitrageMockConnector:
    """ArbitrageMockConnector output and determinism."""

    def test_fetch_quotes_returns_list(self) -> None:
        connector = ArbitrageMockConnector()
        quotes = connector.fetch_quotes()
        assert isinstance(quotes, list)

    def test_fetch_quotes_returns_arbitrage_quotes(self) -> None:
        connector = ArbitrageMockConnector()
        quotes = connector.fetch_quotes()
        for q in quotes:
            assert isinstance(q, ArbitrageQuote)
            assert q.dex in connector.dexes
            assert q.pair in connector.pairs
            assert q.price > 0
            assert q.liquidity > 0
            assert q.timestamp is not None

    def test_fetch_quotes_covers_pairs_and_dexes(self) -> None:
        connector = ArbitrageMockConnector()
        quotes = connector.fetch_quotes()
        pairs_seen = {q.pair for q in quotes}
        dexes_seen = {q.dex for q in quotes}
        assert pairs_seen == set(connector.pairs)
        assert dexes_seen == set(connector.dexes)

    def test_fetch_quotes_count(self) -> None:
        connector = ArbitrageMockConnector()
        quotes = connector.fetch_quotes()
        expected_count = len(connector.pairs) * len(connector.dexes)
        assert len(quotes) == expected_count

    def test_fetch_quotes_deterministic_spreads(self) -> None:
        """Mock connector uses fixed dex_adjustments so spreads are reproducible."""
        connector = ArbitrageMockConnector()
        quotes = connector.fetch_quotes()
        by_pair: dict[str, list[ArbitrageQuote]] = {}
        for q in quotes:
            by_pair.setdefault(q.pair, []).append(q)
        for pair, pair_quotes in by_pair.items():
            prices = [q.price for q in pair_quotes]
            assert len(prices) == len(connector.dexes)
            assert min(prices) < max(prices), f"Expected spread for {pair}"

    def test_fetch_quotes_without_db_does_not_publish(self) -> None:
        """When db is None, fetch_quotes does not attempt to publish events."""
        connector = ArbitrageMockConnector()
        quotes = connector.fetch_quotes(db=None)
        assert len(quotes) > 0


class TestFetchOrMock:
    """fetch_or_mock helper (Jupiter fallback to mock)."""

    def test_fetch_or_mock_returns_list(self) -> None:
        result = fetch_or_mock()
        assert isinstance(result, list)

    def test_fetch_or_mock_returns_arbitrage_quotes(self) -> None:
        result = fetch_or_mock()
        assert len(result) > 0
        for q in result:
            assert isinstance(q, ArbitrageQuote)
