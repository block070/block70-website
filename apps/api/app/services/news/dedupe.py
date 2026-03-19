from __future__ import annotations

import re
from datetime import timedelta
from difflib import SequenceMatcher

from app.services.news.normalize import canonicalize_url
from app.services.news.types import SourceArticle


def normalize_title_key(title: str) -> str:
    value = title.lower()
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def is_similar(a: SourceArticle, b: SourceArticle) -> bool:
    if canonicalize_url(a.url) == canonicalize_url(b.url):
        return True
    title_a = normalize_title_key(a.title)
    title_b = normalize_title_key(b.title)
    if title_a == title_b:
        return True
    ratio = SequenceMatcher(None, title_a, title_b).ratio()
    if ratio < 0.88:
        return False
    if a.published_at and b.published_at:
        if abs(a.published_at - b.published_at) > timedelta(hours=12):
            return False
    return True


def cluster_articles(articles: list[SourceArticle]) -> list[list[SourceArticle]]:
    clusters: list[list[SourceArticle]] = []
    for article in articles:
        attached = False
        for cluster in clusters:
            if is_similar(article, cluster[0]):
                cluster.append(article)
                attached = True
                break
        if not attached:
            clusters.append([article])
    return clusters
