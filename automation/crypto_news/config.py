from __future__ import annotations

"""
Configuration for the Crypto Articles on the Hour system.

All values are safe to import from other modules. Environment variables can
override some defaults at runtime.
"""

from dataclasses import dataclass
import os
from typing import List


@dataclass(frozen=True)
class CryptoNewsConfig:
    # RSS feeds to aggregate
    rss_feeds: List[str] = (
        "https://feeds.feedburner.com/CoinDesk",
        "https://cointelegraph.com/rss",
    )

    # Ollama configuration
    ollama_base_url: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model: str = os.environ.get("OLLAMA_MODEL", "llama3")

    # Article generation
    min_words: int = int(os.environ.get("CRYPTO_NEWS_MIN_WORDS", "300"))
    max_words: int = int(os.environ.get("CRYPTO_NEWS_MAX_WORDS", "600"))

    # SQLite database path (relative to project root)
    sqlite_path: str = os.environ.get(
        "CRYPTO_NEWS_SQLITE_PATH",
        os.path.join(os.path.dirname(__file__), "automation.db"),
    )

    # Optional Block70 API base URL (if set, publisher will POST here)
    block70_api_base_url: str | None = os.environ.get("BLOCK70_API_BASE_URL")

    # Logging
    log_level: str = os.environ.get("CRYPTO_NEWS_LOG_LEVEL", "INFO")
    log_to_stdout: bool = True


CONFIG = CryptoNewsConfig()

