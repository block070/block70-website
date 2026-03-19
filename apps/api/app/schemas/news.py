from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field
from pydantic.config import ConfigDict


class NewsEntityRead(BaseModel):
    entity_type: str
    value: str
    normalized_value: Optional[str] = None
    extra: Optional[dict[str, Any]] = None


class NewsArticleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    source_type: str
    title: str
    url: str
    published_at: Optional[datetime] = None
    author: Optional[str] = None
    summary: Optional[str] = None
    body_text: Optional[str] = None
    image_url: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    tickers: list[str] = Field(default_factory=list)
    entities: list[dict[str, Any]] = Field(default_factory=list)
    sentiment: float = 0.0
    engagement: dict[str, Any] = Field(default_factory=dict)
    dedupe_cluster_id: Optional[int] = None
    source_count: int = 1
    dedupe_count: int = 1
    rank_explanation: dict[str, Any] = Field(default_factory=dict)
    homepage_score: Optional[float] = None
    coin_scores: dict[str, float] = Field(default_factory=dict)
    quality_status: str = "keep"


class NewsListResponse(BaseModel):
    items: list[NewsArticleRead]
    total: int


class NewsSearchResponse(BaseModel):
    q: str
    items: list[NewsArticleRead]
    total: int


class NewsDebugResponse(BaseModel):
    article: NewsArticleRead
    cluster: Optional[dict[str, Any]] = None
    raw_events: list[dict[str, Any]] = Field(default_factory=list)


class NewsIngestionResult(BaseModel):
    started_at: datetime
    completed_at: datetime
    sources_attempted: int
    sources_succeeded: int
    source_errors: list[dict[str, Any]] = Field(default_factory=list)
    items_fetched: int
    items_normalized: int
    items_persisted: int
    clusters_created: int
    cache_hits: int = 0
    cache_misses: int = 0


NewsSourceType = Literal["api", "rss", "scrape"]
