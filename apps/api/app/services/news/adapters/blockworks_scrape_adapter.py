from __future__ import annotations

import time
from datetime import datetime, timezone
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from app.services.news.adapters.base import NewsSourceAdapter
from app.services.news.http import cached_get_text
from app.services.news.types import SourceArticle, SourceFetchResult


class BlockworksScrapeAdapter(NewsSourceAdapter):
    source = "Blockworks"
    adapter_name = "blockworksScrapeAdapter"
    archive_url = "https://blockworks.co/news/archive"

    def fetch_latest(self, limit: int = 50) -> SourceFetchResult:
        started = time.perf_counter()
        try:
            html, cache_hit = cached_get_text(self.archive_url, ttl_seconds=300)
            soup = BeautifulSoup(html, "html.parser")
            items: list[SourceArticle] = []

            anchors = soup.select("a[href*='/news/']")
            seen: set[str] = set()
            for anchor in anchors:
                href = (anchor.get("href") or "").strip()
                title = anchor.get_text(" ", strip=True)
                if not href or not title:
                    continue
                url = urljoin("https://blockworks.co", href)
                if url in seen:
                    continue
                seen.add(url)
                items.append(
                    SourceArticle(
                        source=self.source,
                        source_type="scrape",
                        title=title,
                        url=url,
                        published_at=datetime.now(timezone.utc),
                        raw={"href": href},
                    )
                )
                if len(items) >= limit:
                    break

            return SourceFetchResult(
                source=self.source,
                adapter=self.adapter_name,
                items=items,
                duration_ms=int((time.perf_counter() - started) * 1000),
                request_meta={"cache_hit": cache_hit, "url": self.archive_url},
            )
        except Exception as exc:  # noqa: BLE001
            return SourceFetchResult(
                source=self.source,
                adapter=self.adapter_name,
                items=[],
                duration_ms=int((time.perf_counter() - started) * 1000),
                error=str(exc),
                request_meta={"url": self.archive_url},
            )
