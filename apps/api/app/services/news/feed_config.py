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
    {"source": "NewsBTC", "url": "https://www.newsbtc.com/feed"},
    {"source": "Bitcoin Magazine", "url": "https://bitcoinmagazine.com/feed"},
    {"source": "Bitcoin.com News", "url": "https://news.bitcoin.com/feed/"},
    {"source": "Bitcoinist", "url": "https://bitcoinist.com/feed/"},
    {"source": "Crypto Briefing", "url": "https://cryptobriefing.com/feed/"},
    {"source": "CryptoPotato", "url": "https://cryptopotato.com/feed"},
    {"source": "CoinJournal", "url": "https://coinjournal.net/feed/"},
    {"source": "CoinPedia", "url": "https://coinpedia.org/feed/"},
    {"source": "Coindoo", "url": "https://coindoo.com/feed/"},
    {"source": "CryptoTicker", "url": "https://cryptoticker.io/en/feed/"},
    {"source": "CryptoNewsZ", "url": "https://cryptonewsz.com/feed/"},
    {"source": "CryptoNinjas", "url": "https://cryptoninjas.net/feed/"},
    {"source": "U.Today", "url": "https://u.today/rss"},
    {"source": "ZyCrypto", "url": "https://zycrypto.com/feed/"},
    {"source": "Inside Bitcoins", "url": "https://insidebitcoins.com/feed"},
    {"source": "NullTX", "url": "https://nulltx.com/feed/"},
    {"source": "DC Forecasts", "url": "https://www.dcforecasts.com/feed/"},
    {"source": "Finance Magnates", "url": "https://www.financemagnates.com/cryptocurrency/feed/"},
    {"source": "Kraken Blog", "url": "https://blog.kraken.com/feed"},
    {"source": "Changelly Blog", "url": "https://changelly.com/blog/feed/"},
    {"source": "NOWPayments Blog", "url": "https://nowpayments.io/blog/feed/"},
    {"source": "Coin Central", "url": "https://coincentral.com/news/feed/"},
    {"source": "CoinCheckUp", "url": "https://coincheckup.com/blog/feed/"},
    {"source": "CoinStats Blog", "url": "https://coinstats.app/blog/feed"},
    {"source": "Crypto Breaking", "url": "https://cryptobreaking.com/feed/"},
    {"source": "Crypto Economy", "url": "https://crypto-economy.com/feed"},
    {"source": "Tron Weekly", "url": "https://www.tronweekly.com/feed/"},
    {"source": "The Crypto Basic", "url": "https://thecryptobasic.com/feed/"},
    {"source": "The News Crypto", "url": "https://thenewscrypto.com/feed/"},
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
