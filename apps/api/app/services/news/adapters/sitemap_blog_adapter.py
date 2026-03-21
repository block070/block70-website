"""
Sitemap-based blog crawler for crypto project blogs.

Fetches sitemap, discovers article URLs, fetches HTML and extracts
title, description, and date. Reuses the ingestion pipeline.
"""

from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from typing import Optional
from xml.etree import ElementTree

from app.services.news.adapters.base import NewsSourceAdapter
from app.services.news.http import cached_get_text
from app.services.news.types import SourceArticle, SourceFetchResult


def _parse_sitemap_urls(xml_text: str, max_urls: int = 50) -> list[str]:
    """Parse sitemap XML and return <loc> URLs. Handles sitemap index and URL set."""
    urls: list[str] = []
    try:
        root = ElementTree.fromstring(xml_text)
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        for loc in root.findall(".//sm:loc", ns):
            if loc is not None and loc.text:
                urls.append(loc.text.strip())
                if len(urls) >= max_urls:
                    break
        if not urls:
            for loc in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc"):
                if loc is not None and loc.text:
                    urls.append(loc.text.strip())
                    if len(urls) >= max_urls:
                        break
        if not urls:
            for loc in root.iter():
                if loc.tag.endswith("loc") and loc.text:
                    urls.append(loc.text.strip())
                    if len(urls) >= max_urls:
                        break
    except ElementTree.ParseError:
        pass
    return urls


def _extract_meta(html: str) -> tuple[Optional[str], Optional[str], Optional[datetime]]:
    """Extract title, description, published_at from HTML meta tags and content."""
    title: Optional[str] = None
    description: Optional[str] = None
    published_at: Optional[datetime] = None

    # og:title, og:description, article:published_time
    og_title = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]*content=["\']([^"\']+)["\']', html, re.I)
    if og_title:
        title = og_title.group(1).strip()
    if not title:
        title_match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
        if title_match:
            title = title_match.group(1).strip()

    og_desc = re.search(
        r'<meta[^>]+property=["\']og:description["\'][^>]*content=["\']([^"\']+)["\']', html, re.I
    )
    if og_desc:
        description = og_desc.group(1).strip()
    if not description:
        meta_desc = re.search(
            r'<meta[^>]+name=["\']description["\'][^>]*content=["\']([^"\']+)["\']', html, re.I
        )
        if meta_desc:
            description = meta_desc.group(1).strip()

    pub_time = re.search(
        r'<meta[^>]+property=["\']article:published_time["\'][^>]*content=["\']([^"\']+)["\']', html, re.I
    )
    if pub_time:
        try:
            published_at = datetime.fromisoformat(
                pub_time.group(1).replace("Z", "+00:00")
            ).astimezone(timezone.utc)
        except (ValueError, TypeError):
            pass
    if not published_at and "<time" in html.lower():
        time_match = re.search(
            r'<time[^>]+datetime=["\']([^"\']+)["\']', html, re.I
        )
        if time_match:
            try:
                published_at = datetime.fromisoformat(
                    time_match.group(1).replace("Z", "+00:00")
                ).astimezone(timezone.utc)
            except (ValueError, TypeError):
                pass

    return title, description, published_at


# Predefined project blog sitemaps for crypto/Web3
SITEMAP_BLOGS = [
    ("Ethereum Blog", "https://blog.ethereum.org/sitemap.xml"),
    ("Uniswap Blog", "https://blog.uniswap.org/sitemap.xml"),
]


class SitemapBlogAdapter(NewsSourceAdapter):
    """
    Crawls a sitemap, fetches article URLs, extracts metadata from HTML.
    """

    def __init__(
        self,
        source: str,
        sitemap_url: str,
        *,
        max_articles: int = 15,
        path_filter: Optional[str] = None,
    ) -> None:
        self.source = source
        self.sitemap_url = sitemap_url
        self.max_articles = max_articles
        self.path_filter = path_filter  # e.g. "/news/" to only include news URLs
        self.adapter_name = f"sitemapBlog_{source.replace(' ', '_')}"

    def fetch_latest(self, limit: int = 50) -> SourceFetchResult:
        started = time.perf_counter()
        items: list[SourceArticle] = []
        try:
            xml_text, _ = cached_get_text(self.sitemap_url, ttl_seconds=600)
            urls = _parse_sitemap_urls(xml_text, max_urls=self.max_articles)
            if self.path_filter:
                urls = [u for u in urls if self.path_filter in u]
            for url in urls[: self.max_articles]:
                try:
                    html, _ = cached_get_text(url, ttl_seconds=3600)
                    title, description, published_at = _extract_meta(html)
                    if title and url:
                        items.append(
                            SourceArticle(
                                source=self.source,
                                source_type="scrape",
                                title=title,
                                url=url,
                                published_at=published_at,
                                summary=description,
                                raw={"url": url},
                            )
                        )
                except Exception:
                    continue
            return SourceFetchResult(
                source=self.source,
                adapter=self.adapter_name,
                items=items,
                duration_ms=int((time.perf_counter() - started) * 1000),
                request_meta={"sitemap": self.sitemap_url},
            )
        except Exception as exc:
            return SourceFetchResult(
                source=self.source,
                adapter=self.adapter_name,
                items=[],
                duration_ms=int((time.perf_counter() - started) * 1000),
                error=str(exc),
                request_meta={"sitemap": self.sitemap_url},
            )


def make_sitemap_adapters() -> list[SitemapBlogAdapter]:
    """Create sitemap adapters for configured project blogs."""
    return [
        SitemapBlogAdapter(source, sitemap_url, max_articles=12)
        for source, sitemap_url in SITEMAP_BLOGS
    ]
