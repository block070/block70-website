"""
Rank alpha posts by votes, engagement, author reputation, recency.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import AlphaPost, AlphaVote, AlphaComment, UserReputation


class TrendingAlphaEngine:
    def rank(
        self,
        db: Session,
        *,
        limit: int = 20,
        since_hours: int = 168,  # 7 days
    ) -> List[int]:
        """
        Return post IDs ordered by trending score (votes + engagement + reputation + recency).
        """
        since = datetime.now(timezone.utc) - timedelta(hours=since_hours)
        posts = (
            db.query(AlphaPost)
            .filter(AlphaPost.created_at >= since)
            .all()
        )
        if not posts:
            return []

        post_ids = [p.id for p in posts]
        # Vote scores per post
        vote_scores = {}
        for pid in post_ids:
            up = db.query(AlphaVote).filter(
                AlphaVote.post_id == pid,
                AlphaVote.vote_type == "up",
            ).count()
            down = db.query(AlphaVote).filter(
                AlphaVote.post_id == pid,
                AlphaVote.vote_type == "down",
            ).count()
            vote_scores[pid] = up - down

        # Comment counts
        comment_counts = {}
        for pid in post_ids:
            comment_counts[pid] = db.query(AlphaComment).filter(
                AlphaComment.post_id == pid,
            ).count()

        # Author reputation
        author_rep = {}
        for p in posts:
            r = db.query(UserReputation).filter(
                UserReputation.user_id == p.user_id,
            ).first()
            author_rep[p.id] = (r.reputation_score or 0.0) if r else 0.0

        # Recency: newer = higher
        now = datetime.now(timezone.utc)
        def recency_score(created_at: datetime) -> float:
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            hours_ago = (now - created_at).total_seconds() / 3600.0
            return max(0, 1.0 - hours_ago / (since_hours or 1))

        def trend_score(pid: int) -> float:
            p = next((x for x in posts if x.id == pid), None)
            if not p:
                return 0.0
            v = vote_scores.get(pid, 0) * 2.0
            c = comment_counts.get(pid, 0) * 1.0
            r = author_rep.get(pid, 0.0) * 0.5
            rec = recency_score(p.created_at) * 10.0
            return v + c + r + rec

        post_ids.sort(key=trend_score, reverse=True)
        return post_ids[:limit]


trending_alpha_engine = TrendingAlphaEngine()
