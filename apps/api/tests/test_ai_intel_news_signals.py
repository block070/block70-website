from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.services.ai_intelligence.hour_intel_client import hour_sentiment_to_0_100
from app.services.ai_intelligence.news_signals import (
    _accumulate_from_articles,
    _scores_from_acc,
    _sentiment_to_unit_interval,
)


def test_sentiment_to_unit_interval_signed() -> None:
    assert _sentiment_to_unit_interval(-1.0) == 0.0
    assert _sentiment_to_unit_interval(0.0) == 50.0
    assert _sentiment_to_unit_interval(1.0) == 100.0


def test_sentiment_to_unit_interval_large() -> None:
    assert _sentiment_to_unit_interval(75.0) == 75.0


def test_hour_sentiment_maps_neg100_to_0() -> None:
    assert hour_sentiment_to_0_100(-100) == 0.0
    assert hour_sentiment_to_0_100(0) == 50.0
    assert hour_sentiment_to_0_100(100) == 100.0


def test_accumulate_and_scores() -> None:
    class Row:
        def __init__(self) -> None:
            self.tickers = ["BTC", "ETH"]
            self.sentiment = 0.0
            self.coin_scores = None
            self.homepage_score = 120.0
            self.published_at = datetime.now(timezone.utc)

    since_24 = datetime.now(timezone.utc) - timedelta(seconds=5)
    acc, mentions24, hits = _accumulate_from_articles([Row()], since_24)
    scores = _scores_from_acc(acc, hits)
    assert "BTC" in scores and "ETH" in scores
    assert mentions24.get("BTC", 0) >= 1
