from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

import feedparser
from sqlalchemy.orm import Session

from app.models import NewsArticle


COINDESK_RSS = "https://www.coindesk.com/arc/outboundfeeds/rss/"
COINTELEGRAPH_RSS = "https://cointelegraph.com/rss"


def _parse_feed(db: Session, url: str, source_name: str) -> None:
    feed = feedparser.parse(url)
    for entry in feed.entries:
        link = getattr(entry, "link", None)
        title = getattr(entry, "title", None)
        summary = getattr(entry, "summary", None) or getattr(
            entry, "description", None
        )

        if not link or not title:
            continue

        # Deduplicate on URL
        existing = (
            db.query(NewsArticle)
            .filter(NewsArticle.url == link)
            .first()
        )
        if existing:
            continue

        published = None
        if getattr(entry, "published_parsed", None):
            published = datetime.fromtimestamp(
                datetime(*entry.published_parsed[:6]).timestamp(), tz=timezone.utc
            )

        article = NewsArticle(
            title=title.strip(),
            source=source_name,
            url=link,
            summary=summary,
            content=None,
            published_at=published,
        )
        db.add(article)


def run_news_scraper(db: Session) -> None:
    """
    Fetch and store latest crypto news from RSS feeds.

    Sources:
    - CoinDesk RSS
    - CoinTelegraph RSS
    """
    _parse_feed(db, COINDESK_RSS, "CoinDesk")
    _parse_feed(db, COINTELEGRAPH_RSS, "CoinTelegraph")
    db.commit()

