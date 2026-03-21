"""
Configurable crypto news RSS feed list.

Stored on the backend; update this file or set NEWS_FEEDS_JSON env
to add/remove sources. Format: [{"source": "Name", "url": "https://..."}, ...]
"""

from __future__ import annotations

import json
import os
from typing import List

DEFAULT_FEEDS: List[dict[str, str]] = [
    {"source": "CoinDesk", "url": "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml"},
    {"source": "CoinTelegraph", "url": "https://cointelegraph.com/rss"},
    {"source": "Decrypt", "url": "https://decrypt.co/feed"},
    {"source": "The Block", "url": "https://www.theblockcrypto.com/rss.xml"},
    {"source": "CryptoSlate", "url": "https://cryptoslate.com/feed/"},
    {"source": "NewsBTC", "url": "https://www.newsbtc.com/feed/"},
    {"source": "Bitcoin Magazine", "url": "https://bitcoinmagazine.com/feed"},
    {"source": "Crypto Briefing", "url": "https://cryptobriefing.com/feed/"},
    {"source": "CoinGape", "url": "https://coingape.com/feed/"},
    {"source": "Investopedia", "url": "https://www.investopedia.com/feeds/all.xml"},
]


def get_feed_list() -> List[dict[str, str]]:
    """Return configured RSS feeds. Env NEWS_FEEDS_JSON overrides defaults."""
    raw = os.getenv("NEWS_FEEDS_JSON", "").strip()
    if raw:
        try:
            data = json.loads(raw)
            if isinstance(data, list) and data:
                return [
                    {"source": str(item.get("source", "Unknown")), "url": str(item.get("url", ""))}
                    for item in data
                    if item.get("url")
                ]
        except json.JSONDecodeError:
            pass
    return DEFAULT_FEEDS
