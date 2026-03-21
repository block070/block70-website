"""
PostgreSQL full-text search for news articles.

Uses tsvector with weighted fields: title (A), summary (B), body_text (C).
Boosts recent articles and articles mentioning trending coins via caller-side logic.
"""

from __future__ import annotations

from typing import List, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import NewsArticle


def search_news_fts(
    db: Session,
    search_term: str,
    limit: int = 30,
    config: str = "english",
) -> List[Tuple[float, NewsArticle]]:
    """
    Full-text search on NewsArticle using PostgreSQL tsvector/tsquery.
    title (A), summary (B), body_text (C). Returns (ts_rank score, row) tuples.
    Falls back to empty list on any error (e.g. non-PostgreSQL).
    """
    if not search_term or not search_term.strip():
        return []

    try:
        stmt = text("""
            WITH ranked AS (
                SELECT
                    na.id,
                    ts_rank_cd(
                        setweight(to_tsvector(:config, coalesce(na.title, '')), 'A') ||
                        setweight(to_tsvector(:config, coalesce(na.summary, '')), 'B') ||
                        setweight(to_tsvector(:config, coalesce(na.body_text, '')), 'C'),
                        plainto_tsquery(:config, :q)
                    ) AS score
                FROM news_articles na
                WHERE (
                    setweight(to_tsvector(:config, coalesce(na.title, '')), 'A') ||
                    setweight(to_tsvector(:config, coalesce(na.summary, '')), 'B') ||
                    setweight(to_tsvector(:config, coalesce(na.body_text, '')), 'C')
                ) @@ plainto_tsquery(:config, :q)
                ORDER BY score DESC
                LIMIT :limit
            )
            SELECT r.score, r.id FROM ranked r
        """).bindparams(
            q=search_term.strip(),
            config=config,
            limit=limit,
        )

        rows = db.execute(stmt).fetchall()
    except Exception:
        return []

    if not rows:
        return []

    score_by_id = {r.id: float(r.score or 0.0) for r in rows}
    ids_ordered = [r.id for r in rows]

    articles = db.query(NewsArticle).filter(NewsArticle.id.in_(ids_ordered)).all()
    by_id = {a.id: a for a in articles}

    return [
        (score_by_id[mid], by_id[mid])
        for mid in ids_ordered
        if mid in by_id
    ]
