"""Aggregate recent news into per-ticker scores (0–100) and prompt bullets."""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.news_article import NewsArticle
from app.services.connectors.market_cache import market_cache_get, market_cache_set

logger = logging.getLogger(__name__)

_NEWS_AGG_TTL = 90
_NEWS_AGG_TYP = "ai_intel_news_scores"


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _sentiment_to_unit_interval(raw: float) -> float:
    """Map stored sentiment to 0–100. Values in [-1.5, 1.5] treated as [-1, 1] scale."""
    if -1.5 <= raw <= 1.5:
        return _clamp((raw + 1.0) / 2.0 * 100.0)
    return _clamp(raw)


def _coin_score_value(coin_scores: dict[str, Any] | None, ticker: str) -> float | None:
    if not coin_scores:
        return None
    up = ticker.upper()
    for k, v in coin_scores.items():
        if str(k).upper() == up:
            try:
                return float(v)
            except (TypeError, ValueError):
                return None
    return None


def _article_ticker_sentiment(
    base_sentiment: float,
    coin_scores: dict[str, Any] | None,
    ticker: str,
) -> float:
    u = _sentiment_to_unit_interval(float(base_sentiment))
    cs = _coin_score_value(coin_scores, ticker)
    if cs is not None:
        u = (u + _sentiment_to_unit_interval(cs)) / 2.0
    return _clamp(u)


def _accumulate_from_articles(
    articles: list[NewsArticle],
    since_24h: datetime,
) -> tuple[dict[str, tuple[float, float]], dict[str, int], dict[str, int]]:
    """
    Returns:
      scores_acc: ticker -> (weighted_sum, weight)
      mentions_24h: ticker -> headline count in last 24h
      hits_window: ticker -> headline count in full `articles` window (saturation cap)
    """
    acc: dict[str, tuple[float, float]] = {}
    mentions: dict[str, int] = {}
    hits_window: dict[str, int] = {}

    for art in articles:
        tickers = art.tickers or []
        if not tickers:
            continue
        spread = max(1, len(tickers))
        hp = float(art.homepage_score or 0.0)
        article_w = 1.0 + min(2.0, hp / 120.0)

        pub = art.published_at
        in_24 = pub is None or pub >= since_24h

        for t in tickers:
            sym = str(t).strip().upper()
            if not sym:
                continue
            sent = _article_ticker_sentiment(float(art.sentiment or 0.0), art.coin_scores, sym)
            w = article_w / math.sqrt(float(spread))
            s0, w0 = acc.get(sym, (0.0, 0.0))
            acc[sym] = (s0 + sent * w, w0 + w)
            hits_window[sym] = hits_window.get(sym, 0) + 1
            if in_24:
                mentions[sym] = mentions.get(sym, 0) + 1

    return acc, mentions, hits_window


def _scores_from_acc(acc: dict[str, tuple[float, float]], mention_count: dict[str, int]) -> dict[str, float]:
    """Weighted average with mild saturation when a ticker is mentioned in very many articles."""
    out: dict[str, float] = {}
    for sym, (s_sum, w_sum) in acc.items():
        if w_sum <= 0:
            continue
        avg = s_sum / w_sum
        n = max(1, mention_count.get(sym, 1))
        shrink = min(1.0, 1.15 / math.log1p(n))
        adj = 50.0 + (avg - 50.0) * shrink
        out[sym] = round(_clamp(adj), 3)
    return out


def _build_bullets(
    scores: dict[str, float],
    mentions: dict[str, int],
    *,
    limit: int = 3,
) -> list[str]:
    ranked = sorted(
        mentions.items(),
        key=lambda kv: (kv[1], -abs(scores.get(kv[0], 50.0) - 50.0)),
        reverse=True,
    )
    lines: list[str] = []
    for sym, cnt in ranked[:limit]:
        sc = scores.get(sym)
        if sc is None:
            continue
        bias = "neutral"
        if sc >= 58:
            bias = "bullish-leaning"
        elif sc <= 42:
            bias = "bearish-leaning"
        lines.append(f"{sym}: {cnt} headline(s) in 24h; blended news sentiment ~{sc:.0f}/100 ({bias}).")
    return lines


@dataclass(frozen=True)
class NewsIntelAggregate:
    scores: dict[str, float]
    mentions_24h: dict[str, int]
    bullets: list[str]


def build_news_intel_aggregate(db: Session, *, hours: int = 48) -> NewsIntelAggregate:
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=hours)
    since_24 = now - timedelta(hours=24)

    rows = (
        db.query(NewsArticle)
        .filter(
            or_(
                NewsArticle.published_at == None,  # noqa: E711
                NewsArticle.published_at >= since,
            )
        )
        .order_by(NewsArticle.homepage_score.desc().nullslast(), NewsArticle.published_at.desc().nullslast())
        .limit(2000)
        .all()
    )
    acc, mentions, hits_window = _accumulate_from_articles(rows, since_24)
    scores = _scores_from_acc(acc, hits_window)
    bullets = _build_bullets(scores, mentions, limit=3)
    return NewsIntelAggregate(scores=scores, mentions_24h=mentions, bullets=bullets)


def get_news_intel_aggregate_cached(db: Session, *, hours: int = 48) -> NewsIntelAggregate:
    """Never raises: returns empty aggregate on cache/DB/build errors so ranking still works."""
    try:
        cached = market_cache_get(_NEWS_AGG_TYP, _NEWS_AGG_TTL, hours=hours)
        if isinstance(cached, dict) and "scores" in cached and "mentions_24h" in cached:
            b = cached.get("bullets") or []
            if isinstance(b, list):
                scores: dict[str, float] = {}
                for k, v in (cached.get("scores") or {}).items():
                    try:
                        scores[str(k)] = float(v)
                    except (TypeError, ValueError):
                        continue
                mentions_24h: dict[str, int] = {}
                for k, v in (cached.get("mentions_24h") or {}).items():
                    try:
                        mentions_24h[str(k)] = int(v)
                    except (TypeError, ValueError):
                        continue
                return NewsIntelAggregate(
                    scores=scores,
                    mentions_24h=mentions_24h,
                    bullets=[str(x) for x in b],
                )
        agg = build_news_intel_aggregate(db, hours=hours)
        market_cache_set(
            _NEWS_AGG_TYP,
            _NEWS_AGG_TTL,
            {
                "scores": agg.scores,
                "mentions_24h": agg.mentions_24h,
                "bullets": agg.bullets,
            },
            hours=hours,
        )
        return agg
    except Exception as e:
        logger.warning("get_news_intel_aggregate_cached failed: %s", e, exc_info=True)
        return NewsIntelAggregate(scores={}, mentions_24h={}, bullets=[])
