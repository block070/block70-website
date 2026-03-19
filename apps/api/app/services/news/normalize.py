from __future__ import annotations

import html
import re
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from app.services.news.types import SourceArticle

TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "ref",
    "source",
    "fbclid",
    "gclid",
}


def strip_html(value: str | None) -> str | None:
    if not value:
        return value
    cleaned = re.sub(r"<[^>]+>", " ", value)
    cleaned = html.unescape(cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def canonicalize_url(url: str) -> str:
    parsed = urlparse(url.strip())
    query_pairs = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() not in TRACKING_PARAMS
    ]
    canonical_query = urlencode(query_pairs, doseq=True)
    netloc = parsed.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    path = parsed.path.rstrip("/") or "/"
    return urlunparse((parsed.scheme or "https", netloc, path, "", canonical_query, ""))


def normalize_source_article(article: SourceArticle) -> SourceArticle:
    return SourceArticle(
        source=article.source.strip(),
        source_type=article.source_type,
        title=strip_html(article.title) or "",
        url=canonicalize_url(article.url),
        published_at=article.published_at,
        author=strip_html(article.author),
        summary=strip_html(article.summary),
        body_text=strip_html(article.body_text),
        image_url=article.image_url,
        tags=[strip_html(tag) or "" for tag in article.tags if strip_html(tag)],
        tickers=[t.upper() for t in article.tickers if t],
        entities=article.entities,
        sentiment=article.sentiment,
        engagement=article.engagement,
        raw=article.raw,
    )
