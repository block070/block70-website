from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.services.news.adapters.blockworks_scrape_adapter import BlockworksScrapeAdapter
from app.services.news.adapters.coindesk_api_adapter import CoinDeskApiAdapter
from app.services.news.adapters.coindesk_rss_adapter import CoinDeskRssAdapter
from app.services.news.adapters.cointelegraph_rss_adapter import CointelegraphRssAdapter
from app.services.news.adapters.decrypt_rss_adapter import DecryptRssAdapter
from app.services.news.dedupe import cluster_articles
from app.services.news.normalize import canonicalize_url, normalize_source_article
from app.services.news.ranking import cross_source_confirmation_score, homepage_score, recency_score
from app.services.news.types import SourceArticle


FIXTURES = Path(__file__).parent / "fixtures"


def _read_fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def test_coindesk_rss_adapter_parses_items(monkeypatch):
    xml = _read_fixture("coindesk_rss.xml")
    monkeypatch.setattr(
        "app.services.news.adapters.coindesk_rss_adapter.cached_get_text",
        lambda *_args, **_kwargs: (xml, False),
    )
    adapter = CoinDeskRssAdapter()
    result = adapter.fetch_latest(limit=5)
    assert result.error is None
    assert result.items
    assert result.items[0].source == "CoinDesk"


def test_cointelegraph_rss_adapter_parses_items(monkeypatch):
    xml = _read_fixture("cointelegraph_rss.xml")
    monkeypatch.setattr(
        "app.services.news.adapters.cointelegraph_rss_adapter.cached_get_text",
        lambda *_args, **_kwargs: (xml, True),
    )
    adapter = CointelegraphRssAdapter()
    result = adapter.fetch_latest(limit=5)
    assert result.error is None
    assert len(result.items) == 1


def test_decrypt_rss_adapter_parses_items(monkeypatch):
    xml = _read_fixture("decrypt_rss.xml")
    monkeypatch.setattr(
        "app.services.news.adapters.decrypt_rss_adapter.cached_get_text",
        lambda *_args, **_kwargs: (xml, False),
    )
    adapter = DecryptRssAdapter()
    result = adapter.fetch_latest(limit=5)
    assert result.error is None
    assert result.items[0].source == "Decrypt"


def test_coindesk_api_adapter_parses_items(monkeypatch):
    payload = json.loads(_read_fixture("coindesk_api.json"))
    monkeypatch.setattr(
        "app.services.news.adapters.coindesk_api_adapter.cached_get_json",
        lambda *_args, **_kwargs: (payload, False),
    )
    adapter = CoinDeskApiAdapter()
    result = adapter.fetch_latest(limit=10)
    assert result.error is None
    assert len(result.items) == 1
    assert result.items[0].source_type == "api"


def test_blockworks_scrape_adapter_parses_items(monkeypatch):
    html = _read_fixture("blockworks_archive.html")
    monkeypatch.setattr(
        "app.services.news.adapters.blockworks_scrape_adapter.cached_get_text",
        lambda *_args, **_kwargs: (html, False),
    )
    adapter = BlockworksScrapeAdapter()
    result = adapter.fetch_latest(limit=2)
    assert result.error is None
    assert len(result.items) == 2
    assert all(item.source == "Blockworks" for item in result.items)


def test_url_canonicalization_removes_tracking():
    url = "https://www.coindesk.com/markets/x/?utm_source=a&ref=b&x=1"
    assert canonicalize_url(url) == "https://coindesk.com/markets/x?x=1"


def test_dedupe_clusters_similar_titles():
    base_time = datetime.now(timezone.utc)
    a = SourceArticle(source="CoinDesk", source_type="rss", title="Bitcoin ETF approved", url="https://a")
    b = SourceArticle(
        source="Decrypt",
        source_type="rss",
        title="Bitcoin ETF approved!",
        url="https://b",
        published_at=base_time + timedelta(minutes=10),
    )
    clusters = cluster_articles([a, b])
    assert len(clusters) == 1
    assert len(clusters[0]) == 2


def test_ranking_scores_are_nonzero():
    article = normalize_source_article(
        SourceArticle(
            source="CoinDesk",
            source_type="rss",
            title="BTC and Ethereum rally",
            url="https://example.com/a",
            published_at=datetime.now(timezone.utc) - timedelta(hours=2),
            summary="Bitcoin and Ethereum move higher",
            engagement={"views": 25000, "shares": 1500},
        )
    )
    score, explanation = homepage_score(article, source_count=2)
    assert score > 0
    assert explanation["source_count"] == 2
    assert recency_score(article.published_at) >= 90
    assert cross_source_confirmation_score(2) == 55.0
