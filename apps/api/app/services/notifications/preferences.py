from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import NotificationPreference


def get_or_create_prefs(db: Session, user_id: int) -> NotificationPreference:
    p = db.query(NotificationPreference).filter(NotificationPreference.user_id == user_id).first()
    if p is not None:
        return p
    p = NotificationPreference(user_id=user_id)
    db.add(p)
    db.flush()
    return p
