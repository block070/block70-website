"""
Evaluate alpha posts against market outcomes and update user reputation/accuracy.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import AlphaPost, UserReputation, PriceSnapshot


def _get_or_create_reputation(db: Session, user_id: int) -> UserReputation:
    r = db.query(UserReputation).filter(UserReputation.user_id == user_id).first()
    if r:
        return r
    r = UserReputation(user_id=user_id)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def evaluate_post_accuracy(
    db: Session,
    post_id: int,
    *,
    price_at_post: float | None = None,
    price_later: float | None = None,
    outcome_correct: bool | None = None,
) -> None:
    """
    Update author reputation when we have an outcome (e.g. price moved as predicted).
    If outcome_correct is True, increase alpha_accuracy and reputation_score.
    """
    post = db.get(AlphaPost, post_id)
    if not post:
        return
    rep = _get_or_create_reputation(db, post.user_id)
    # Simple running average: if we have a verdict, blend into alpha_accuracy
    if outcome_correct is not None:
        # Weight by post confidence
        weight = 0.1 + post.confidence_score * 0.2
        new_accuracy = rep.alpha_accuracy * (1 - weight) + (1.0 if outcome_correct else 0.0) * weight
        rep.alpha_accuracy = min(1.0, max(0.0, new_accuracy))
        if outcome_correct:
            rep.reputation_score = (rep.reputation_score or 0) + 1.0 * post.confidence_score
        db.add(rep)
        db.commit()


def update_reputation_from_prices(
    db: Session,
    post_id: int,
    token_symbol: str,
    hours_later: int = 24,
) -> bool | None:
    """
    Compare post creation time price to price after hours_later; if token went up,
    treat as "correct" for a trade_idea/signal. Returns True/False if evaluated, None if not enough data.
    """
    post = db.get(AlphaPost, post_id)
    if not post or not post.token_symbol:
        return None
    from datetime import timedelta, timezone
    created = post.created_at.replace(tzinfo=timezone.utc) if post.created_at.tzinfo is None else post.created_at
    later = created + timedelta(hours=hours_later)
    price_before = (
        db.query(PriceSnapshot)
        .filter(
            PriceSnapshot.token_symbol == token_symbol.upper(),
            PriceSnapshot.timestamp <= created,
        )
        .order_by(PriceSnapshot.timestamp.desc())
        .first()
    )
    price_after = (
        db.query(PriceSnapshot)
        .filter(
            PriceSnapshot.token_symbol == token_symbol.upper(),
            PriceSnapshot.timestamp >= later,
        )
        .order_by(PriceSnapshot.timestamp.asc())
        .first()
    )
    if not price_before or not price_after or price_before.price <= 0:
        return None
    pct = (price_after.price - price_before.price) / price_before.price * 100.0
    # Heuristic: "correct" if positive move for a trade_idea/signal
    outcome = pct > 0
    evaluate_post_accuracy(db, post_id, outcome_correct=outcome)
    return outcome


class AlphaAccuracyService:
    evaluate_post_accuracy = staticmethod(evaluate_post_accuracy)
    update_reputation_from_prices = staticmethod(update_reputation_from_prices)


alpha_accuracy_service = AlphaAccuracyService()
