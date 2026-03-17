from __future__ import annotations

"""
Hourly "Crypto Articles on the Hour" orchestrator.

Entry point:
    python automation/crypto_news/main.py
"""

from datetime import datetime
from typing import List

from .config import CONFIG
from .db import init_db
from .deduper import is_duplicate, mark_processed
from .scraper import ScrapedArticle, fetch_latest_articles
from .utils import log, setup_logging
from .writer import GeneratedArticle, OllamaWriter
from .publisher import publish_article


def _filter_candidates(articles: List[ScrapedArticle], max_items: int = 10) -> List[ScrapedArticle]:
    """Filter low-quality entries and truncate."""
    filtered: List[ScrapedArticle] = []
    for a in articles:
        if not a.summary or len(a.summary.split()) < 20:
            # very short or empty summaries are usually low-signal
            continue
        filtered.append(a)
        if len(filtered) >= max_items:
            break
    return filtered


def run_once() -> None:
    setup_logging()
    init_db()

    log("INFO", f"Starting crypto news automation run at {datetime.utcnow().isoformat()}Z")

    articles = fetch_latest_articles(limit_per_feed=10)
    candidates = _filter_candidates(articles, max_items=10)

    if not candidates:
        log("INFO", "No suitable RSS articles found for this run.")
        return

    writer = OllamaWriter()
    processed_count = 0
    skipped_duplicates = 0
    generation_failures = 0
    publish_failures = 0

    for article in candidates:
        if is_duplicate(article.title, article.url):
            skipped_duplicates += 1
            continue

        generated: GeneratedArticle | None = writer.generate_article(
            source_title=article.title,
            source_summary=article.summary,
        )
        if not generated:
            generation_failures += 1
            continue

        result = publish_article(
            title=generated.title,
            content=generated.content,
            source_url=article.url,
            sentiment=generated.sentiment,
        )
        if not result.success:
            publish_failures += 1
            # even if publish failed we still mark as processed to avoid loops
            mark_processed(article.title, article.url)
            continue

        mark_processed(article.title, article.url)
        processed_count += 1

    log(
        "INFO",
        f"Run summary: processed={processed_count}, duplicates={skipped_duplicates}, "
        f"generation_failures={generation_failures}, publish_failures={publish_failures}",
    )


if __name__ == "__main__":
    run_once()

