"""
Generic RSS adapter for easy addition of new crypto news feeds.

Used for The Block, BeInCrypto, and other niche sites.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import feedparser

from app.services.news.adapters.base import NewsSourceAdapter
from app.services.news.http import cached_get_text
from app.services.news.types import SourceArticle, SourceFetchResult


class GenericRssAdapter(NewsSourceAdapter):
    """Configurable RSS adapter. Instantiate with source name and feed URL."""

    def __init__(self, source: str, rss_url: str, *, adapter_suffix: str = "Rss") -> None:
        self.source = source
        self.rss_url = rss_url
        self.adapter_name = f"genericRss_{source.replace(' ', '_')}{adapter_suffix}"

    def fetch_latest(self, limit: int = 50) -> SourceFetchResult:
        started = time.perf_counter()
        try:
            xml_text, cache_hit = cached_get_text(self.rss_url, ttl_seconds=300)
            parsed = feedparser.parse(xml_text)
            items: list[SourceArticle] = []
            for entry in parsed.entries[:limit]:
                title = (getattr(entry, "title", "") or "").strip()
                url = (getattr(entry, "link", "") or "").strip()
                if not title or not url:
                    continue

                published_at = None
                published = getattr(entry, "published", None) or getattr(entry, "updated", None)
                if published:
                    try:
                        published_at = parsedate_to_datetime(published).astimezone(timezone.utc)
                    except Exception:
                        published_at = None

                items.append(
                    SourceArticle(
                        source=self.source,
                        source_type="rss",
                        title=title,
                        url=url,
                        published_at=published_at,
                        author=(getattr(entry, "author", None) or None),
                        summary=(getattr(entry, "summary", None) or None),
                        tags=[t.term for t in getattr(entry, "tags", []) if getattr(t, "term", None)],
                        raw={"entry": dict(entry)},
                    )
                )

            return SourceFetchResult(
                source=self.source,
                adapter=self.adapter_name,
                items=items,
                duration_ms=int((time.perf_counter() - started) * 1000),
                request_meta={"cache_hit": cache_hit, "url": self.rss_url},
            )
        except Exception as exc:
            return SourceFetchResult(
                source=self.source,
                adapter=self.adapter_name,
                items=[],
                duration_ms=int((time.perf_counter() - started) * 1000),
                error=str(exc),
                request_meta={"url": self.rss_url},
            )
