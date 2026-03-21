"""
Block70 Search Service.

Unified search across coins, news (with ranking), and static routes.
Ranking: score = keyword_match_score + recency_weight + coin_popularity_weight + mention_frequency
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Set

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import Coin, MarketData, NewsArticle
from app.schemas.search import (
    SearchResultCoins,
    SearchResultNews,
    SearchResultStatic,
)
from app.services.analysis.trending_signal_engine import TrendingSignalEngine


# Static route definitions: (keyword_fragments, category, title, href)
STATIC_ROUTES = [
    (["signal", "sig"], "signals", "Signals feed", "/signals"),
    (["airdrop"], "airdrops", "Airdrops", "/airdrops"),
    (["wallet", "whale"], "wallets", "Smart wallets", "/wallets"),
    (["narrative"], "narratives", "Narratives", "/narratives"),
    (["opportunit"], "signals", "Opportunities", "/opportunities"),
]


def _recency_weight(published_at: Optional[datetime]) -> float:
    """Decay by age: 1.0 for < 6h, 0.8 for < 24h, 0.6 for < 48h, 0.4 for < 7d."""
    if not published_at:
        return 0.3
    now = datetime.now(timezone.utc)
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)
    delta = now - published_at
    hours = delta.total_seconds() / 3600.0
    if hours < 6:
        return 1.0
    if hours < 24:
        return 0.8
    if hours < 48:
        return 0.6
    if hours < 168:  # 7 days
        return 0.4
    return 0.2


def _coin_popularity_weight(
    tickers: Optional[List[str]],
    trending_symbols: Set[str],
    limit: int = 20,
) -> float:
    """Boost if article mentions trending coins."""
    if not tickers or not trending_symbols:
        return 0.0
    ticker_set = {t.upper() for t in tickers}
    overlap = len(ticker_set & trending_symbols)
    if overlap == 0:
        return 0.0
    return min(0.5, overlap * 0.15)  # cap at 0.5


def _mention_frequency_bonus(
    query_upper: str,
    tickers: Optional[List[str]],
) -> float:
    """Bonus for articles mentioning query as a ticker multiple times."""
    if not tickers:
        return 0.0
    ticker_set = {t.upper() for t in tickers}
    if query_upper not in ticker_set:
        return 0.0
    return 0.2  # fixed bonus for direct ticker match


class SearchService:
    """
    Unified search: coins (DB), news (weighted scoring), static routes.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    def search(
        self,
        q: str,
        limit: int = 20,
        categories: Optional[List[str]] = None,
    ) -> List[SearchResultCoins | SearchResultNews | SearchResultStatic]:
        """
        Execute unified search and return ranked results.
        categories: optional filter (e.g. ["coins", "news"]).
        """
        q_clean = q.strip()
        if not q_clean or len(q_clean) < 2:
            return []

        q_lower = q_clean.lower()
        q_upper = q_clean.upper()
        limit = min(max(limit, 1), 50)
        cat_set = set(categories) if categories else None

        results: List[SearchResultCoins | SearchResultNews | SearchResultStatic] = []

        # 1. Coins
        if cat_set is None or "coins" in cat_set:
            coin_results = self._search_coins(q_lower, q_upper, limit=8)
            results.extend(coin_results)

        # 2. Static routes
        if cat_set is None or any(c in cat_set for c in ["wallets", "airdrops", "signals", "narratives"]):
            static_results = self._search_static(q_lower, limit=4)
            results.extend(static_results)

        # 3. News (weighted scoring)
        if cat_set is None or "news" in cat_set:
            news_results = self._search_news(q_lower, q_upper, limit=min(limit, 15))
            results.extend(news_results)

        # Interleave by relevance: coins first, then static, then news
        # (or we could sort all by score - for now keep category order)
        return results[:limit]

    def _search_coins(
        self,
        q_lower: str,
        q_upper: str,
        limit: int = 8,
    ) -> List[SearchResultCoins]:
        """Search coins by symbol, name, slug."""
        like = f"%{q_lower}%"
        rows = (
            self.db.query(Coin)
            .filter(
                or_(
                    Coin.symbol.ilike(like),
                    Coin.name.ilike(like),
                    Coin.slug.ilike(like),
                )
            )
            .order_by(Coin.market_cap.desc().nullslast())
            .limit(limit)
            .all()
        )

        # Enrich with price_change_24h, trending_rank, signal_count_24h (Phase 4)
        trending_engine = TrendingSignalEngine(lookback_hours=24.0)
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        trending_tokens = trending_engine.get_trending(self.db, since=since, limit=50)
        symbol_to_signal_count = {
            (t.token_symbol or "").upper(): t.signal_count for t in trending_tokens
        }
        trending_symbols = set(symbol_to_signal_count.keys())
        symbol_to_rank = {s: i + 1 for i, s in enumerate(trending_symbols)}

        items: List[SearchResultCoins] = []
        for coin in rows:
            latest_md = (
                self.db.query(MarketData)
                .filter(MarketData.coin_id == coin.id)
                .order_by(MarketData.timestamp.desc())
                .first()
            )
            price_change_24h = latest_md.price_change_24h if latest_md else None
            symbol_upper = coin.symbol.upper()
            trending_rank = symbol_to_rank.get(symbol_upper)
            signal_count_24h = symbol_to_signal_count.get(symbol_upper)

            items.append(
                SearchResultCoins(
                    id=coin.symbol,
                    category="coins",
                    title=coin.symbol,
                    subtitle="Coin",
                    href=f"/coins/{coin.slug}",
                    price_change_24h=price_change_24h,
                    trending_rank=trending_rank,
                    signal_count_24h=signal_count_24h,
                )
            )
        return items

    def _search_static(self, q_lower: str, limit: int = 4) -> List[SearchResultStatic]:
        """Match static routes by keyword."""
        items: List[SearchResultStatic] = []
        for fragments, category, title, href in STATIC_ROUTES:
            if any(f in q_lower for f in fragments):
                items.append(
                    SearchResultStatic(
                        id=href.strip("/"),
                        category=category,
                        title=title,
                        href=href,
                    )
                )
                if len(items) >= limit:
                    break
        return items

    def _search_news(
        self,
        q_lower: str,
        q_upper: str,
        limit: int = 15,
    ) -> List[SearchResultNews]:
        """Search news with PostgreSQL FTS (tsvector) and weighted scoring."""
        from app.services.news.fts import search_news_fts

        fts_results = search_news_fts(self.db, search_term=q_lower, limit=limit * 2)
        if not fts_results:
            # Fallback: ilike when FTS returns nothing
            like = f"%{q_lower}%"
            rows = (
                self.db.query(NewsArticle)
                .filter(
                    or_(
                        NewsArticle.title.ilike(like),
                        NewsArticle.summary.ilike(like),
                        NewsArticle.body_text.ilike(like),
                    )
                )
                .limit(limit * 2)
                .all()
            )
            fts_results = [(0.1, r) for r in rows]  # dummy score

        # Get trending symbols for coin_popularity_weight
        trending_engine = TrendingSignalEngine(lookback_hours=24.0)
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        trending_tokens = trending_engine.get_trending(self.db, since=since, limit=30)
        trending_symbols: Set[str] = {
            (t.token_symbol or "").upper() for t in trending_tokens if t.token_symbol
        }

        scored: List[tuple[float, NewsArticle]] = []
        for ts_rank, row in fts_results:
            rec = _recency_weight(row.published_at)
            cp = _coin_popularity_weight(row.tickers, trending_symbols)
            mf = _mention_frequency_bonus(q_upper, row.tickers)
            base = (row.homepage_score or 0.0) * 0.1
            score = ts_rank * 2.0 + rec * 1.0 + cp + mf + base
            scored.append((score, row))

        scored.sort(key=lambda x: -x[0])
        top = scored[:limit]

        return [
            SearchResultNews(
                id=f"news-{row.id}",
                category="news",
                title=row.title,
                subtitle=row.source,
                href=row.url,
                source=row.source,
                published_at=row.published_at,
                score=round(score, 2),
            )
            for score, row in top
        ]
