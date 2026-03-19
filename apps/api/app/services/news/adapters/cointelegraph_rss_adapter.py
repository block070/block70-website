from __future__ import annotations

import time
from datetime import timezone
from email.utils import parsedate_to_datetime

import feedparser

from app.services.news.adapters.base import NewsSourceAdapter
from app.services.news.http import cached_get_text
from app.services.news.types import SourceArticle, SourceFetchResult


class CointelegraphRssAdapter(NewsSourceAdapter):
    source = "Cointelegraph"
    adapter_name = "cointelegraphRssAdapter"
    rss_url = "https://cointelegraph.com/rss"

    def fetch_latest(self, limit: int = 50) -> SourceFetchResult:
        started = time.perf_counter()
        try:
            xml_text, cache_hit = cached_get_text(self.rss_url, ttl_seconds=180)
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
                    except Exception:  # noqa: BLE001
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
        except Exception as exc:  # noqa: BLE001
            return SourceFetchResult(
                source=self.source,
                adapter=self.adapter_name,
                items=[],
                duration_ms=int((time.perf_counter() - started) * 1000),
                error=str(exc),
                request_meta={"url": self.rss_url},
            )
