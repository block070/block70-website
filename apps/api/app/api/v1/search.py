"""Unified search API: coins, news, static routes."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.search import (
    SearchResponse,
    SearchResultCoins,
    SearchResultNews,
    SearchResultStatic,
)
from app.services.news.ingestion import NewsIngestionService
from app.services.search.search_service import SearchService


router = APIRouter(prefix="/api/v1/search", tags=["search"])


def _maybe_refresh_news(db: Session) -> None:
    """Refresh news if stale (reuse news router logic)."""
    from datetime import datetime, timedelta, timezone

    from app.models import NewsArticle

    latest = db.query(NewsArticle).order_by(NewsArticle.created_at.desc()).first()
    if latest and latest.created_at:
        created_at = latest.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if created_at >= datetime.now(timezone.utc) - timedelta(minutes=10):
            return
    service = NewsIngestionService(db)
    service.ingest_latest(limit_per_source=40)


@router.get("", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    categories: Optional[str] = Query(
        None,
        description="Comma-separated: coins,news,wallets,airdrops,signals,narratives",
    ),
    db: Session = Depends(get_db),
) -> SearchResponse:
    """
    Unified search across coins, news (ranked), and static routes.

    Ranking for news: keyword_match_score + recency_weight + coin_popularity_weight
    + mention_frequency.
    """
    _maybe_refresh_news(db)

    cat_list: Optional[List[str]] = None
    if categories:
        cat_list = [c.strip().lower() for c in categories.split(",") if c.strip()]

    service = SearchService(db)
    results: List[SearchResultCoins | SearchResultNews | SearchResultStatic] = (
        service.search(q=q, limit=limit, categories=cat_list)
    )

    return SearchResponse(q=q.strip(), results=results)
