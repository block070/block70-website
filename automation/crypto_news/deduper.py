from __future__ import annotations

"""
Deduplication logic for processed RSS articles.
"""

from automation.crypto_news.db import has_article, mark_article_processed
from automation.crypto_news.utils import compute_hash, log


def is_duplicate(title: str, url: str) -> bool:
    hash_value = compute_hash(title, url)
    if has_article(hash_value):
        log("INFO", f"Skipping duplicate article: {title} ({url})")
        return True
    return False


def mark_processed(title: str, url: str) -> None:
    hash_value = compute_hash(title, url)
    mark_article_processed(title, url, hash_value)
    log("INFO", f"Marked article as processed: {title} ({url})")

