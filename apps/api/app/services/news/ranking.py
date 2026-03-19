from __future__ import annotations

import math
from datetime import datetime, timezone

from app.services.news.entities import COIN_ALIAS_MAP
from app.services.news.types import SourceArticle

SOURCE_AUTHORITY = {
    "CoinDesk": 95.0,
    "Cointelegraph": 90.0,
    "Decrypt": 88.0,
    "Blockworks": 88.0,
    "social_repost": 40.0,
}


def recency_score(published_at: datetime | None, now: datetime | None = None) -> float:
    if not published_at:
        return 10.0
    now = now or datetime.now(timezone.utc)
    delta_h = max(0.0, (now - published_at).total_seconds() / 3600.0)
    if delta_h <= 1:
        return 100.0
    if delta_h <= 3:
        return 90.0
    if delta_h <= 6:
        return 75.0
    if delta_h <= 12:
        return 55.0
    if delta_h <= 24:
        return 35.0
    if delta_h <= 48:
        return 20.0
    return max(1.0, 20.0 * math.exp(-(delta_h - 48) / 24))


def source_authority_score(source: str) -> float:
    return SOURCE_AUTHORITY.get(source, 30.0)


def cross_source_confirmation_score(source_count: int) -> float:
    if source_count <= 1:
        return 20.0
    if source_count == 2:
        return 55.0
    if source_count == 3:
        return 80.0
    return 100.0


def engagement_score(engagement: dict | None) -> float:
    if not engagement:
        return 50.0
    views = float(engagement.get("views", 0) or 0)
    shares = float(engagement.get("shares", 0) or 0)
    score = 20.0 * math.log1p(min(views, 1_000_000)) + 30.0 * math.log1p(min(shares, 100_000))
    return max(0.0, min(100.0, score / 4.0))


def relevance_score(article: SourceArticle) -> float:
    title = (article.title or "").lower()
    body = (article.body_text or article.summary or "").lower()
    score = 0.0
    for ticker, aliases in COIN_ALIAS_MAP.items():
        if ticker.lower() in title:
            score += 40
        elif ticker.lower() in body:
            score += 20
        for alias in aliases:
            if alias in title:
                score += 20
            elif alias in body:
                score += 10
    return min(100.0, score)


def coin_relevance_score(article: SourceArticle, symbol: str) -> float:
    base = relevance_score(article)
    symbol = symbol.upper()
    title = (article.title or "").upper()
    body = (article.body_text or article.summary or "").upper()
    if symbol in title:
        base += 40
    elif symbol in body:
        base += 20
    if symbol in (article.tickers or []):
        base += 10
    return min(100.0, base)


def homepage_score(article: SourceArticle, source_count: int) -> tuple[float, dict]:
    recency = recency_score(article.published_at)
    relevance = relevance_score(article)
    authority = source_authority_score(article.source)
    cross = cross_source_confirmation_score(source_count)
    engage = engagement_score(article.engagement)
    score = 0.25 * recency + 0.15 * relevance + 0.20 * authority + 0.20 * cross + 0.20 * engage
    return score, {
        "recency": recency,
        "relevance": relevance,
        "authority": authority,
        "cross_source": cross,
        "engagement": engage,
        "source_count": source_count,
    }


def coin_page_score(article: SourceArticle, symbol: str, source_count: int) -> tuple[float, dict]:
    recency = recency_score(article.published_at)
    relevance = coin_relevance_score(article, symbol)
    authority = source_authority_score(article.source)
    cross = cross_source_confirmation_score(source_count)
    engage = engagement_score(article.engagement)
    score = 0.30 * recency + 0.40 * relevance + 0.10 * authority + 0.10 * cross + 0.10 * engage
    return score, {
        "recency": recency,
        "coin_relevance": relevance,
        "authority": authority,
        "cross_source": cross,
        "engagement": engage,
        "source_count": source_count,
        "symbol": symbol.upper(),
    }
