"""
Token discussion feed: comments and upvotes.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import User, TokenComment, TokenCommentVote


router = APIRouter(prefix="/api/v1/tokens", tags=["token-comments"])


class CommentCreate(BaseModel):
    content: str


@router.post("/comments/{comment_id}/upvote")
def upvote_comment(
    comment_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Toggle upvote on a comment. One vote per user per comment."""
    comment = db.get(TokenComment, comment_id)
    if not comment:
        raise HTTPException(404, "Comment not found")
    existing = (
        db.query(TokenCommentVote)
        .filter(
            TokenCommentVote.comment_id == comment_id,
            TokenCommentVote.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        comment.upvotes = max(0, comment.upvotes - 1)
    else:
        db.add(TokenCommentVote(comment_id=comment_id, user_id=current_user.id))
        comment.upvotes = (comment.upvotes or 0) + 1
    db.commit()
    db.refresh(comment)
    return {"comment_id": comment_id, "upvotes": comment.upvotes}


@router.get("/{token}/comments")
def list_comments(
    token: str = Path(..., description="Token symbol"),
    db: Session = Depends(get_db),
    limit: int = 50,
) -> list[dict]:
    """GET /api/v1/tokens/{token}/comments — list comments for a token."""
    token_upper = token.strip().upper()
    rows = (
        db.query(TokenComment)
        .filter(TokenComment.token_symbol == token_upper)
        .order_by(TokenComment.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": c.id,
            "user_id": c.user_id,
            "token_symbol": c.token_symbol,
            "content": c.content,
            "upvotes": c.upvotes,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in rows
    ]


@router.post("/{token}/comments")
def create_comment(
    token: str = Path(..., description="Token symbol"),
    body: CommentCreate = ...,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """POST /api/v1/tokens/{token}/comments — add a comment (auth required)."""
    token_upper = token.strip().upper()
    content = (body and body.content or "").strip()
    if not content or len(content) > 5000:
        raise HTTPException(400, "content required, max 5000 chars")
    comment = TokenComment(
        user_id=current_user.id,
        token_symbol=token_upper,
        content=content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {
        "id": comment.id,
        "user_id": comment.user_id,
        "token_symbol": comment.token_symbol,
        "content": comment.content,
        "upvotes": 0,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
    }
