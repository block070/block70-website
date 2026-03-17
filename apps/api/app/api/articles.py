from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import NewsArticle


router = APIRouter(prefix="/api/v1/articles", tags=["articles"])


class ArticleCreate(BaseModel):
    title: str = Field(..., max_length=512)
    content: str
    source_url: str = Field(..., max_length=1024)
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    published_at: Optional[datetime] = None


@router.post("", status_code=status.HTTP_201_CREATED)
def create_article(payload: ArticleCreate, db: Session = Depends(get_db)) -> dict:
    """
    Create a new Block70 article backed by the existing NewsArticle model.

    We treat the upstream source URL as the canonical URL and store the
    generated content in the `content` field. Deduplication is enforced on URL.
    """
    existing = (
        db.query(NewsArticle)
        .filter(NewsArticle.url == payload.source_url)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Article for this source URL already exists.",
        )

    summary = payload.content[:512]

    article = NewsArticle(
        title=payload.title.strip(),
        source="Block70 AI",
        url=payload.source_url.strip(),
        summary=summary,
        content=payload.content,
        published_at=payload.published_at,
    )
    db.add(article)
    db.commit()
    db.refresh(article)

    return {
        "id": article.id,
        "title": article.title,
        "source_url": article.url,
        "published_at": article.published_at,
    }

