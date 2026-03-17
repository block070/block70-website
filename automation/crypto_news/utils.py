from __future__ import annotations

"""
Utility functions: hashing, sentiment heuristics, tag generation, logging setup.
"""

import hashlib
import logging
from typing import List

from automation.crypto_news.config import CONFIG
from automation.crypto_news.db import log_event


def compute_hash(title: str, url: str) -> str:
    h = hashlib.sha256()
    h.update(title.strip().encode("utf-8"))
    h.update(b"||")
    h.update(url.strip().encode("utf-8"))
    return h.hexdigest()


def setup_logging() -> None:
    level = getattr(logging, CONFIG.log_level.upper(), logging.INFO)
    handlers: List[logging.Handler] = []
    if CONFIG.log_to_stdout:
        handlers.append(logging.StreamHandler())
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=handlers,
    )


def log(level: str, message: str) -> None:
    logger = logging.getLogger("crypto_news")
    logger.log(getattr(logging, level.upper(), logging.INFO), message)
    # also persist to SQLite
    try:
        log_event(level, message)
    except Exception:
        # avoid recursive logging failures
        logger.debug("Failed to persist log to SQLite", exc_info=True)


def infer_sentiment(text: str) -> str:
    """Very simple heuristic sentiment tagging."""
    lower = text.lower()
    positive = ["surge", "rally", "bull", "growth", "record high"]
    negative = ["dump", "crash", "sell-off", "hack", "exploit", "liquidation"]

    score = 0
    for w in positive:
        if w in lower:
            score += 1
    for w in negative:
        if w in lower:
            score -= 1

    if score > 0:
        return "bullish"
    if score < 0:
        return "bearish"
    return "neutral"


def infer_tags(title: str, summary: str) -> List[str]:
    """Generate simple keyword tags from title + summary."""
    text = f"{title} {summary}".lower()
    tags: List[str] = []
    for token, tag in [
        ("bitcoin", "bitcoin"),
        ("btc", "bitcoin"),
        ("ethereum", "ethereum"),
        ("eth", "ethereum"),
        ("solana", "solana"),
        ("sol", "solana"),
        ("layer 2", "l2"),
        ("l2", "l2"),
        ("defi", "defi"),
        ("nft", "nft"),
        ("stablecoin", "stablecoin"),
        ("restaking", "restaking"),
    ]:
        if token in text and tag not in tags:
            tags.append(tag)
    if "crypto" not in tags:
        tags.append("crypto")
    return tags

