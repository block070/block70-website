"""
News scraper job - delegates to NewsIngestionService which uses
configurable RSS feeds from app.services.news.feed_config.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.news.ingestion import NewsIngestionService


def run_news_scraper(db: Session) -> None:
    """
    Fetch and store latest crypto news from configurable RSS feeds.
    Uses NewsIngestionService with feeds from feed_config (10 sources by default).
    """
    service = NewsIngestionService(db)
    service.ingest_latest(limit_per_source=40)

