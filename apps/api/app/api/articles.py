from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from pydantic.config import ConfigDict
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


class ArticleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    source: str
    url: str
    summary: Optional[str] = None
    content: Optional[str] = None
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


@router.get("", response_model=List[ArticleRead])
def list_articles(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> List[ArticleRead]:
    """
    List recent news articles (including Block70 AI-generated ones),
    newest first.
    """
    rows = (
        db.query(NewsArticle)
        .order_by(NewsArticle.published_at.desc().nullslast(), NewsArticle.created_at.desc())
        .limit(limit)
        .all()
    )
    return [ArticleRead.model_validate(row) for row in rows]


@router.get("/{article_id}", response_model=ArticleRead)
def get_article(article_id: int, db: Session = Depends(get_db)) -> ArticleRead:
    article = db.query(NewsArticle).filter(NewsArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return ArticleRead.model_validate(article)

