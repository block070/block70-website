from __future__ import annotations

from dataclasses import dataclass

from app.services.news.ranking import source_authority_score
from app.services.news.types import SourceArticle


@dataclass(slots=True)
class QualityDecision:
    action: str
    reason: str


SPONSOR_TOKENS = ("sponsored", "partner content", "press release", "advertorial")


def evaluate_quality(article: SourceArticle) -> QualityDecision:
    title = (article.title or "").lower()
    body = article.body_text or article.summary or ""
    authority = source_authority_score(article.source)
    if any(token in title for token in SPONSOR_TOKENS):
        return QualityDecision(action="downrank", reason="sponsor_or_advertorial")
    if not article.published_at:
        return QualityDecision(action="downrank", reason="missing_publish_time")
    if len(body.strip()) < 200 and authority < 90:
        return QualityDecision(action="drop", reason="thin_content")
    return QualityDecision(action="keep", reason="passed")
