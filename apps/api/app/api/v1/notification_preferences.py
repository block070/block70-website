from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import User, NotificationPreference
from app.services.notifications.preferences import get_or_create_prefs

router = APIRouter(prefix="/api/v1/notification-preferences", tags=["notification-preferences"])


class NotificationPrefsRead(BaseModel):
    email_digest: bool
    email_realtime: bool
    email_marketing: bool
    push_enabled: bool
    notify_opportunity: bool
    notify_whale: bool
    notify_narrative: bool
    notify_signal: bool
    notify_trial: bool
    notify_reengage: bool


class NotificationPrefsPatch(BaseModel):
    email_digest: bool | None = None
    email_realtime: bool | None = None
    email_marketing: bool | None = None
    push_enabled: bool | None = None
    notify_opportunity: bool | None = None
    notify_whale: bool | None = None
    notify_narrative: bool | None = None
    notify_signal: bool | None = None
    notify_trial: bool | None = None
    notify_reengage: bool | None = None


def _to_read(p: NotificationPreference) -> NotificationPrefsRead:
    return NotificationPrefsRead(
        email_digest=p.email_digest,
        email_realtime=p.email_realtime,
        email_marketing=p.email_marketing,
        push_enabled=p.push_enabled,
        notify_opportunity=p.notify_opportunity,
        notify_whale=p.notify_whale,
        notify_narrative=p.notify_narrative,
        notify_signal=p.notify_signal,
        notify_trial=p.notify_trial,
        notify_reengage=p.notify_reengage,
    )


@router.get("", response_model=NotificationPrefsRead)
def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationPrefsRead:
    p = get_or_create_prefs(db, current_user.id)
    db.commit()
    return _to_read(p)


@router.patch("", response_model=NotificationPrefsRead)
def patch_notification_preferences(
    body: NotificationPrefsPatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationPrefsRead:
    p = get_or_create_prefs(db, current_user.id)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_read(p)
