from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import EmailSendLog
from app.services.narratives.intelligence import compute_intelligence_rows
from app.services.notifications.dispatch import (
    dispatch_narrative_shift,
    run_daily_digest_all_users,
    run_reengagement,
    run_trial_reminders,
)

logger = logging.getLogger(__name__)


def run_narrative_shift_scan(db: Session) -> int:
    """Single narrative broadcast per UTC day when WoW growth exceeds threshold."""
    rows, _ = compute_intelligence_rows(db, narrative_limit=20)
    best: tuple[float, object] | None = None
    eps = 1e-9
    for b in rows:
        gr = b.growth_rate
        if gr is None or b.attention_recent <= eps:
            continue
        if gr <= 0.25:
            continue
        if best is None or gr > best[0]:
            best = (gr, b)
    if best is None:
        return 0
    gr, b = best
    today = datetime.now(timezone.utc).date()
    dedupe = f"narrative_shift_day:{b.narrative.id}:{today.isoformat()}"
    if db.query(EmailSendLog).filter(EmailSendLog.dedupe_key == dedupe).first():
        return 0
    marker = EmailSendLog(
        user_id=None,
        template_key="narrative_shift_broadcast",
        subject="broadcast-marker",
        status="sent",
        dedupe_key=dedupe,
    )
    db.add(marker)
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("narrative shift marker insert")
        return 0
    try:
        growth_text = f"WoW attention growth about {gr:.0%} vs prior week (Block70 model)."
        dispatch_narrative_shift(db, narrative_name=b.narrative.name, growth_text=growth_text)
    except Exception:
        logger.exception("dispatch_narrative_shift")
        db.rollback()
        return 0
    return 1


def run_all_notification_cron_jobs(db: Session) -> dict[str, int]:
    out: dict[str, int] = {}
    out["digest_users_touched"] = run_daily_digest_all_users(db)
    out["trial_reminders"] = run_trial_reminders(db)
    out["reengagement"] = run_reengagement(db)
    out["narrative_shift"] = run_narrative_shift_scan(db)
    return out
