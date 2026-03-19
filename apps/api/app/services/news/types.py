from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional


SourceType = Literal["api", "rss", "scrape"]


@dataclass(slots=True)
class SourceArticle:
    source: str
    source_type: SourceType
    title: str
    url: str
    published_at: Optional[datetime] = None
    author: Optional[str] = None
    summary: Optional[str] = None
    body_text: Optional[str] = None
    image_url: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    tickers: list[str] = field(default_factory=list)
    entities: list[dict[str, Any]] = field(default_factory=list)
    sentiment: float = 0.0
    engagement: dict[str, Any] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class SourceFetchResult:
    source: str
    adapter: str
    items: list[SourceArticle]
    duration_ms: int
    error: Optional[str] = None
    request_meta: dict[str, Any] = field(default_factory=dict)
