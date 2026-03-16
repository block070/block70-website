"""
Community alpha: posts, comments, votes, reputation.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import (
    User,
    AlphaPost,
    AlphaComment,
    AlphaVote,
    UserReputation,
    UserFollow,
)
from app.schemas.alpha_community import (
    AlphaPostRead,
    AlphaPostCreate,
    AlphaCommentRead,
    AlphaCommentCreate,
    AlphaVoteCreate,
)
from app.services.community.trending_alpha_engine import trending_alpha_engine

router = APIRouter(prefix="/api/v1/alpha", tags=["alpha_community"])


def _get_or_create_reputation(db: Session, user_id: int) -> UserReputation:
    r = db.query(UserReputation).filter(UserReputation.user_id == user_id).first()
    if r:
        return r
    r = UserReputation(user_id=user_id)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def _vote_score(db: Session, post_id: int) -> int:
    up = db.query(AlphaVote).filter(
        AlphaVote.post_id == post_id,
        AlphaVote.vote_type == "up",
    ).count()
    down = db.query(AlphaVote).filter(
        AlphaVote.post_id == post_id,
        AlphaVote.vote_type == "down",
    ).count()
    return up - down


def _enrich_post(db: Session, post: AlphaPost) -> Dict[str, Any]:
    author = db.get(User, post.user_id)
    return {
        **AlphaPostRead.model_validate(post).model_dump(),
        "author_name": author.name if author else None,
        "vote_score": _vote_score(db, post.id),
        "comment_count": len(post.comments) if post.comments else db.query(AlphaComment).filter(AlphaComment.post_id == post.id).count(),
    }


@router.get("/posts", response_model=List[Dict[str, Any]])
def list_posts(
    db: Session = Depends(get_db),
    token_symbol: Optional[str] = Query(None),
    alpha_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> List[Dict[str, Any]]:
    """List alpha posts (community feed)."""
    q = db.query(AlphaPost).order_by(AlphaPost.created_at.desc())
    if token_symbol:
        q = q.filter(AlphaPost.token_symbol == token_symbol.upper())
    if alpha_type:
        q = q.filter(AlphaPost.alpha_type == alpha_type)
    rows = q.offset(offset).limit(limit).all()
    return [_enrich_post(db, p) for p in rows]


@router.post("/posts", response_model=Dict[str, Any], status_code=201)
def create_post(
    payload: AlphaPostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Create an alpha post. Awards Blocks for posting."""
    post = AlphaPost(
        user_id=current_user.id,
        title=payload.title,
        content=payload.content,
        token_symbol=payload.token_symbol.upper() if payload.token_symbol else None,
        chain=payload.chain,
        alpha_type=payload.alpha_type,
        confidence_score=payload.confidence_score,
    )
    db.add(post)
    db.flush()
    from app.services.rewards.reward_engine import award_blocks
    award_blocks(db, current_user.id, "alpha_post", description="Alpha post created")
    db.commit()
    db.refresh(post)
    return _enrich_post(db, post)


@router.get("/posts/{post_id}", response_model=Dict[str, Any])
def get_post(
    post_id: int = Path(...),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Get a single post with author and vote/comment counts."""
    post = db.get(AlphaPost, post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    return _enrich_post(db, post)


@router.post("/vote", response_model=Dict[str, Any])
def vote(
    payload: AlphaVoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Upvote or downvote a post (replaces existing vote by user)."""
    post_id = payload.post_id
    post = db.get(AlphaPost, post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    existing = (
        db.query(AlphaVote)
        .filter(AlphaVote.post_id == post_id, AlphaVote.user_id == current_user.id)
        .first()
    )
    if existing:
        existing.vote_type = payload.vote_type
        db.add(existing)
    else:
        v = AlphaVote(post_id=post_id, user_id=current_user.id, vote_type=payload.vote_type)
        db.add(v)
    db.commit()
    return {"post_id": post_id, "vote_type": payload.vote_type, "vote_score": _vote_score(db, post_id)}


@router.post("/comment", response_model=Dict[str, Any], status_code=201)
def create_comment(
    payload: AlphaCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Add a comment to a post."""
    post_id = payload.post_id
    post = db.get(AlphaPost, post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    comment = AlphaComment(
        post_id=post_id,
        user_id=current_user.id,
        content=payload.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    author = db.get(User, comment.user_id)
    return {
        **AlphaCommentRead.model_validate(comment).model_dump(),
        "author_name": author.name if author else None,
    }


@router.get("/posts/{post_id}/comments", response_model=List[Dict[str, Any]])
def list_comments(
    post_id: int = Path(...),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """List comments for a post."""
    post = db.get(AlphaPost, post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    rows = (
        db.query(AlphaComment)
        .filter(AlphaComment.post_id == post_id)
        .order_by(AlphaComment.created_at.asc())
        .all()
    )
    out = []
    for c in rows:
        author = db.get(User, c.user_id)
        out.append({
            **AlphaCommentRead.model_validate(c).model_dump(),
            "author_name": author.name if author else None,
        })
    return out


@router.get("/trending", response_model=List[Dict[str, Any]])
def get_trending(
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=50),
) -> List[Dict[str, Any]]:
    """Trending alpha posts (ranked by votes, engagement, reputation, recency)."""
    post_ids = trending_alpha_engine.rank(db, limit=limit)
    posts = db.query(AlphaPost).filter(AlphaPost.id.in_(post_ids)).all() if post_ids else []
    order = {pid: i for i, pid in enumerate(post_ids)}
    posts.sort(key=lambda p: order.get(p.id, 999))
    return [_enrich_post(db, p) for p in posts]


@router.get("/leaderboard", response_model=List[Dict[str, Any]])
def get_leaderboard(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
) -> List[Dict[str, Any]]:
    """Rank users by reputation, accuracy, engagement."""
    rows = (
        db.query(UserReputation, User)
        .join(User, UserReputation.user_id == User.id)
        .order_by(
            UserReputation.reputation_score.desc(),
            UserReputation.alpha_accuracy.desc(),
        )
        .limit(limit)
        .all()
    )
    return [
        {
            "user_id": r.user_id,
            "name": u.name,
            "reputation_score": r.reputation_score,
            "alpha_accuracy": r.alpha_accuracy,
            "followers": r.followers,
        }
        for r, u in rows
    ]


@router.get("/users/{user_id}/posts", response_model=List[Dict[str, Any]])
def list_user_posts(
    user_id: int = Path(...),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
) -> List[Dict[str, Any]]:
    """List posts by a user (for profile)."""
    posts = (
        db.query(AlphaPost)
        .filter(AlphaPost.user_id == user_id)
        .order_by(AlphaPost.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_enrich_post(db, p) for p in posts]


@router.get("/users/{user_id}/profile", response_model=Dict[str, Any])
def get_user_profile(
    user_id: int = Path(...),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """User profile: reputation, followers, post count."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    rep = _get_or_create_reputation(db, user_id)
    post_count = db.query(AlphaPost).filter(AlphaPost.user_id == user_id).count()
    return {
        "user_id": user.id,
        "name": user.name,
        "reputation_score": rep.reputation_score,
        "alpha_accuracy": rep.alpha_accuracy,
        "followers": rep.followers,
        "post_count": post_count,
    }


class FollowPayload(BaseModel):
    following_id: int


@router.post("/follow")
def follow_user(
    payload: FollowPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Follow a user."""
    following_id = payload.following_id
    if following_id == current_user.id:
        raise HTTPException(400, "Cannot follow yourself")
    existing = (
        db.query(UserFollow)
        .filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == following_id,
        )
        .first()
    )
    if existing:
        return {"status": "already_following"}
    db.add(UserFollow(follower_id=current_user.id, following_id=following_id))
    rep = _get_or_create_reputation(db, following_id)
    rep.followers = (rep.followers or 0) + 1
    db.add(rep)
    db.commit()
    return {"status": "ok"}


@router.delete("/follow")
def unfollow_user(
    following_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Unfollow a user."""
    row = (
        db.query(UserFollow)
        .filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == following_id,
        )
        .first()
    )
    if row:
        db.delete(row)
        rep = _get_or_create_reputation(db, following_id)
        rep.followers = max(0, (rep.followers or 0) - 1)
        db.add(rep)
        db.commit()
    return {"status": "ok"}
