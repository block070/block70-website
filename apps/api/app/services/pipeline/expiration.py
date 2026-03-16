from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Opportunity, OpportunityStatus


def compute_expires_at(opportunity_type: str, detected_at: datetime) -> datetime:
    """
    Compute expiration time based on opportunity type.

    - arbitrage: 10 minutes
    - wallet: 2 hours
    - mining: 24 hours
    """
    detected_at = detected_at.astimezone(timezone.utc)

    ttl_by_type = {
        "arbitrage": timedelta(minutes=10),
        "wallet": timedelta(hours=2),
        "mining": timedelta(days=1),
    }
    ttl = ttl_by_type.get(opportunity_type, timedelta(hours=4))
    return detected_at + ttl


def is_expired(expires_at: datetime | None, now: datetime | None = None) -> bool:
    if expires_at is None:
        return False
    if now is None:
        now = datetime.now(timezone.utc)
    return expires_at <= now


def expire_stale_opportunities(db: Session, now: datetime | None = None) -> int:
    """
    Mark opportunities as expired when their expires_at is in the past.

    Expired opportunities remain stored in the database but are no longer
    considered ACTIVE and should be hidden from active feeds.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    q = (
        db.query(Opportunity)
        .filter(
            Opportunity.status == OpportunityStatus.ACTIVE.value,
            Opportunity.expires_at.isnot(None),
            Opportunity.expires_at < now,
        )
    )

    updated = 0
    for opp in q.all():
        opp.status = OpportunityStatus.EXPIRED.value
        updated += 1

    if updated:
        db.flush()

    return updated


