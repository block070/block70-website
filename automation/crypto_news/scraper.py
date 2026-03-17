from __future__ import annotations

"""
RSS scraper for crypto news feeds.

Uses feedparser to pull CoinDesk and CoinTelegraph articles and normalizes
them into a simple dict shape.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List

import feedparser  # type: ignore[import]

from automation.crypto_news.config import CONFIG
from automation.crypto_news.utils import log


@dataclass
class ScrapedArticle:
    source: str
    title: str
    url: str
    published_at: datetime | None
    summary: str


def _parse_datetime(entry) -> datetime | None:
    try:
        if getattr(entry, "published_parsed", None):
            dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            return dt
    except Exception:
        return None
    return None


def fetch_latest_articles(limit_per_feed: int = 10) -> List[ScrapedArticle]:
    articles: List[ScrapedArticle] = []
    for feed_url in CONFIG.rss_feeds:
        try:
            parsed = feedparser.parse(feed_url)
        except Exception as exc:
            log("ERROR", f"Failed to parse RSS feed {feed_url}: {exc}")
            continue

        for entry in parsed.entries[:limit_per_feed]:
            title = getattr(entry, "title", "").strip()
            link = getattr(entry, "link", "").strip()
            summary = getattr(entry, "summary", "").strip() or getattr(
                entry, "description", ""
            ).strip()

            if not title or not link:
                continue

            published_at = _parse_datetime(entry)
            articles.append(
                ScrapedArticle(
                    source=parsed.feed.get("title", feed_url),
                    title=title,
                    url=link,
                    published_at=published_at,
                    summary=summary,
                )
            )

    log("INFO", f"Fetched {len(articles)} RSS articles from {len(CONFIG.rss_feeds)} feeds")
    return articles

