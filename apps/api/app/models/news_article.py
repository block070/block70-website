from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class NewsArticle(Base):
    __tablename__ = "news_articles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Core source metadata
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    source: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="rss")
    url: Mapped[str] = mapped_column(String(1024), nullable=False, unique=True, index=True)

    # Canonical content fields
    author: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # legacy
    body_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    tags: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    tickers: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    entities: Mapped[Optional[list[dict]]] = mapped_column(JSON, nullable=True)

    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    sentiment: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    engagement: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    dedupe_cluster_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("news_clusters.id"),
        nullable=True,
        index=True,
    )
    rank_explanation: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    homepage_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True, index=True)
    coin_scores: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    source_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    dedupe_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    quality_status: Mapped[str] = mapped_column(String(32), nullable=False, default="keep")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class NewsCluster(Base):
    __tablename__ = "news_clusters"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    canonical_article_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("news_articles.id"), nullable=True, index=True
    )
    title_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True, index=True)
    time_window_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    time_window_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    source_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    article_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class NewsRawEvent(Base):
    __tablename__ = "news_raw_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    source: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    adapter: Mapped[str] = mapped_column(String(128), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    request_meta: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    parse_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class NewsEntity(Base):
    __tablename__ = "news_entities"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    article_id: Mapped[int] = mapped_column(ForeignKey("news_articles.id"), index=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    value: Mapped[str] = mapped_column(String(256), nullable=False)
    normalized_value: Mapped[Optional[str]] = mapped_column(String(256), nullable=True, index=True)
    extra: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

