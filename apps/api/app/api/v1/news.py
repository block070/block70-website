from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import NewsArticle, NewsCluster, NewsRawEvent
from app.schemas.news import (
    NewsArticleRead,
    NewsDebugResponse,
    NewsListResponse,
    NewsSearchResponse,
)
from app.services.news.ingestion import NewsIngestionService


router = APIRouter(prefix="/api/news", tags=["news"])


def _serialize_article(row: NewsArticle) -> NewsArticleRead:
    return NewsArticleRead(
        id=row.id,
        source=row.source,
        source_type=row.source_type,
        title=row.title,
        url=row.url,
        published_at=row.published_at,
        author=row.author,
        summary=row.summary,
        body_text=row.body_text,
        image_url=row.image_url,
        tags=row.tags or [],
        tickers=row.tickers or [],
        entities=row.entities or [],
        sentiment=row.sentiment or 0.0,
        engagement=row.engagement or {},
        dedupe_cluster_id=row.dedupe_cluster_id,
        source_count=row.source_count or 1,
        dedupe_count=row.dedupe_count or 1,
        rank_explanation=row.rank_explanation or {},
        homepage_score=row.homepage_score,
        coin_scores=row.coin_scores or {},
        quality_status=row.quality_status or "keep",
    )


def _maybe_refresh_news(db: Session) -> None:
    latest = db.query(NewsArticle).order_by(NewsArticle.created_at.desc()).first()
    if latest and latest.created_at:
        created_at = latest.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if created_at >= datetime.now(timezone.utc) - timedelta(minutes=10):
            return
    service = NewsIngestionService(db)
    service.ingest_latest(limit_per_source=40)


@router.get("/trending", response_model=NewsListResponse)
def get_trending_news(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> NewsListResponse:
    _maybe_refresh_news(db)
    since = datetime.now(timezone.utc) - timedelta(hours=48)
    rows = (
        db.query(NewsArticle)
        .filter(
            or_(
                NewsArticle.published_at == None,  # noqa: E711
                NewsArticle.published_at >= since,
            )
        )
        .order_by(NewsArticle.homepage_score.desc().nullslast(), NewsArticle.published_at.desc().nullslast())
        .limit(limit)
        .all()
    )
    items = [_serialize_article(row) for row in rows]
    return NewsListResponse(items=items, total=len(items))


@router.get("/latest", response_model=NewsListResponse)
def get_latest_news(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> NewsListResponse:
    _maybe_refresh_news(db)
    rows = (
        db.query(NewsArticle)
        .order_by(NewsArticle.published_at.desc().nullslast(), NewsArticle.created_at.desc())
        .limit(limit)
        .all()
    )
    items = [_serialize_article(row) for row in rows]
    return NewsListResponse(items=items, total=len(items))


@router.get("/coin/{symbol}", response_model=NewsListResponse)
def get_coin_news(
    symbol: str,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> NewsListResponse:
    _maybe_refresh_news(db)
    target = symbol.upper()
    rows = db.query(NewsArticle).all()
    filtered = [row for row in rows if target in (row.tickers or [])]
    filtered.sort(
        key=lambda row: ((row.coin_scores or {}).get(target, 0.0), row.published_at or datetime.min),
        reverse=True,
    )
    sliced = filtered[:limit]
    items = [_serialize_article(row) for row in sliced]
    return NewsListResponse(items=items, total=len(items))


@router.get("/search", response_model=NewsSearchResponse)
def search_news(
    q: str = Query(..., min_length=2),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
) -> NewsSearchResponse:
    _maybe_refresh_news(db)
    from app.services.news.fts import search_news_fts

    fts_results = search_news_fts(db, search_term=q, limit=limit)
    if fts_results:
        items = [_serialize_article(row) for _, row in fts_results]
        return NewsSearchResponse(q=q, items=items, total=len(items))

    # Fallback to ilike when FTS returns nothing (e.g. non-PostgreSQL, short query)
    like = f"%{q}%"
    rows = (
        db.query(NewsArticle)
        .filter(
            (NewsArticle.title.ilike(like))
            | (NewsArticle.summary.ilike(like))
            | (NewsArticle.body_text.ilike(like))
        )
        .order_by(
            NewsArticle.homepage_score.desc().nullslast(),
            NewsArticle.published_at.desc().nullslast(),
        )
        .limit(limit)
        .all()
    )
    items = [_serialize_article(row) for row in rows]
    return NewsSearchResponse(q=q, items=items, total=len(items))


@router.get("/debug/{article_id}", response_model=NewsDebugResponse)
def get_news_debug(article_id: int, db: Session = Depends(get_db)) -> NewsDebugResponse:
    article = db.query(NewsArticle).filter(NewsArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="News article not found")
    cluster_payload = None
    if article.dedupe_cluster_id:
        cluster = db.query(NewsCluster).filter(NewsCluster.id == article.dedupe_cluster_id).first()
        if cluster:
            cluster_payload = {
                "id": cluster.id,
                "canonical_article_id": cluster.canonical_article_id,
                "source_count": cluster.source_count,
                "article_count": cluster.article_count,
                "title_key": cluster.title_key,
            }
    raw_rows = (
        db.query(NewsRawEvent)
        .filter(NewsRawEvent.source == article.source)
        .order_by(NewsRawEvent.fetched_at.desc())
        .limit(10)
        .all()
    )
    raw_payload = [
        {
            "id": row.id,
            "source": row.source,
            "adapter": row.adapter,
            "fetched_at": row.fetched_at,
            "request_meta": row.request_meta,
            "parse_error": row.parse_error,
        }
        for row in raw_rows
    ]
    return NewsDebugResponse(
        article=_serialize_article(article),
        cluster=cluster_payload,
        raw_events=raw_payload,
    )
