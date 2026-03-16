"""
Tests for expiration logic (compute_expires_at, is_expired, expire_stale_opportunities).

Covers: TTL by type, is_expired logic; expire_stale requires DB.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.services.pipeline.expiration import (
    compute_expires_at,
    expire_stale_opportunities,
    is_expired,
)


class TestComputeExpiresAt:
    """compute_expires_at(opportunity_type, detected_at)."""

    def test_arbitrage_ttl_10_minutes(self) -> None:
        now = datetime.now(timezone.utc)
        expires = compute_expires_at("arbitrage", now)
        delta = expires - now
        assert timedelta(minutes=9) <= delta <= timedelta(minutes=11)

    def test_wallet_ttl_2_hours(self) -> None:
        now = datetime.now(timezone.utc)
        expires = compute_expires_at("wallet", now)
        delta = expires - now
        assert timedelta(hours=1, minutes=59) <= delta <= timedelta(hours=2, minutes=1)

    def test_mining_ttl_24_hours(self) -> None:
        now = datetime.now(timezone.utc)
        expires = compute_expires_at("mining", now)
        delta = expires - now
        assert timedelta(hours=23, minutes=59) <= delta <= timedelta(hours=24, minutes=1)

    def test_unknown_type_default_4_hours(self) -> None:
        now = datetime.now(timezone.utc)
        expires = compute_expires_at("unknown_type", now)
        delta = expires - now
        assert timedelta(hours=3, minutes=59) <= delta <= timedelta(hours=4, minutes=1)

    def test_naive_detected_at_converted_to_utc(self) -> None:
        naive = datetime(2025, 3, 1, 12, 0, 0)
        expires = compute_expires_at("arbitrage", naive)
        assert expires.tzinfo is not None


class TestIsExpired:
    """is_expired(expires_at, now)."""

    def test_none_expires_at_not_expired(self) -> None:
        assert is_expired(None) is False

    def test_future_not_expired(self) -> None:
        now = datetime.now(timezone.utc)
        future = now + timedelta(hours=1)
        assert is_expired(future, now=now) is False

    def test_past_expired(self) -> None:
        now = datetime.now(timezone.utc)
        past = now - timedelta(minutes=1)
        assert is_expired(past, now=now) is True

    def test_exact_now_expired(self) -> None:
        now = datetime.now(timezone.utc)
        assert is_expired(now, now=now) is True

    def test_one_second_past_expired(self) -> None:
        now = datetime.now(timezone.utc)
        past = now - timedelta(seconds=1)
        assert is_expired(past, now=now) is True

    def test_one_second_future_not_expired(self) -> None:
        now = datetime.now(timezone.utc)
        future = now + timedelta(seconds=1)
        assert is_expired(future, now=now) is False


class TestExpireStaleOpportunities:
    """expire_stale_opportunities(db) - requires database."""

    def test_expire_stale_returns_int(self, db_session) -> None:
        """When DB is available, expire_stale_opportunities returns an integer count."""
        from sqlalchemy.orm import Session

        assert isinstance(db_session, Session)
        count = expire_stale_opportunities(db_session)
        assert isinstance(count, int)
        assert count >= 0
