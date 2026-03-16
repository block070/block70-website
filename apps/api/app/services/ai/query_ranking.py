"""
Query Ranking: identify most common user questions from AISearchAnalytics.
"""

from __future__ import annotations

from typing import List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import AISearchAnalytics


def normalize_for_ranking(query: str) -> str:
    """Normalize query for grouping (lowercase, collapse whitespace, max length)."""
    return " ".join((query or "").lower().split())[:512]


def record_query(db: Session, query_text: str) -> None:
    """Increment analytics for this query (by normalized form)."""
    key = normalize_for_ranking(query_text)
    if not key:
        return
    from datetime import datetime, timezone
    row = db.query(AISearchAnalytics).filter(
        AISearchAnalytics.query_normalized == key,
    ).first()
    if row:
        row.hit_count += 1
        row.last_seen_at = datetime.now(timezone.utc)
    else:
        db.add(AISearchAnalytics(query_normalized=key, hit_count=1, last_seen_at=datetime.now(timezone.utc)))
    db.commit()


def most_popular_queries(
    db: Session,
    limit: int = 20,
) -> List[dict]:
    """Return most common queries (by hit_count)."""
    rows = (
        db.query(AISearchAnalytics)
        .order_by(AISearchAnalytics.hit_count.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "query_normalized": r.query_normalized,
            "hit_count": r.hit_count,
            "last_seen_at": r.last_seen_at.isoformat() if r.last_seen_at else None,
        }
        for r in rows
    ]
