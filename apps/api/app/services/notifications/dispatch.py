from __future__ import annotations

import logging
import os
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.plan_access import effective_plan
from app.models import (
    EmailSendLog,
    NotificationDeliveryDaily,
    Signal,
    Subscription,
    User,
)
from app.services.alerts.notifications import send_smtp_email
from app.services.notifications.email_templates import (
    render_daily_digest_plain,
    render_narrative_shift_plain,
    render_reengage_plain,
    render_signal_alert_plain,
    render_trial_expiring_plain,
)
from app.services.notifications.notification_engine import NotificationType, notify_user
from app.services.notifications.preferences import get_or_create_prefs
from app.services.email.digest_generator import generate_daily_digest

logger = logging.getLogger(__name__)

REALTIME_CAP = int(os.getenv("NOTIFICATION_REALTIME_DAILY_CAP", "5"))
BROADCAST_USER_LIMIT = int(os.getenv("NOTIFICATION_BROADCAST_USER_LIMIT", "250"))


def _norm_confidence(c: float) -> float:
    if c > 1.0:
        return min(1.0, c / 100.0)
    return float(c or 0.0)


def _latest_subscription(db: Session, user_id: int) -> Subscription | None:
    return (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id)
        .order_by(Subscription.id.desc())
        .first()
    )


def user_segment_label(db: Session, user: User) -> str:
    sub = _latest_subscription(db, user.id)
    eff = effective_plan(user, sub)
    if eff in ("elite", "quant"):
        return "elite"
    if eff == "pro":
        return "pro"
    te = getattr(user, "trial_end", None)
    if te is not None:
        now = datetime.now(timezone.utc)
        end = te if getattr(te, "tzinfo", None) else te.replace(tzinfo=timezone.utc)
        if end > now:
            return "trial"
    return "free"


def try_consume_realtime_slot(db: Session, user_id: int) -> bool:
    today = datetime.now(timezone.utc).date()
    row = (
        db.query(NotificationDeliveryDaily)
        .filter(
            NotificationDeliveryDaily.user_id == user_id,
            NotificationDeliveryDaily.day_utc == today,
            NotificationDeliveryDaily.channel == "realtime",
        )
        .first()
    )
    if row is None:
        row = NotificationDeliveryDaily(
            user_id=user_id,
            day_utc=today,
            channel="realtime",
            count=0,
        )
        db.add(row)
        db.flush()
    if row.count >= REALTIME_CAP:
        return False
    row.count += 1
    return True


def send_logged_email(
    db: Session,
    *,
    user: User,
    template_key: str,
    subject: str,
    body: str,
    dedupe_key: str | None = None,
    digest_utc_date: date | None = None,
) -> bool:
    if dedupe_key and db.query(EmailSendLog).filter(EmailSendLog.dedupe_key == dedupe_key).first():
        return False
    log = EmailSendLog(
        user_id=user.id,
        template_key=template_key,
        subject=subject,
        status="queued",
        dedupe_key=dedupe_key,
        digest_utc_date=digest_utc_date,
    )
    db.add(log)
    db.flush()
    ok, err = send_smtp_email(to_addr=user.email, subject=subject, body=body)
    log.status = "sent" if ok else "failed"
    log.error = err if not ok else None
    log.sent_at = datetime.now(timezone.utc) if ok else None
    return ok


def dispatch_signal_generated(db: Session, signal: Signal) -> None:
    nc = _norm_confidence(float(signal.confidence_score or 0))
    if nc < 0.65:
        return
    content = (
        f"New signal: {signal.signal_type} for {signal.token_symbol or 'token'} "
        f"({signal.title or ''})".strip()
    )
    users = (
        db.query(User)
        .filter(User.is_active.is_(True))
        .filter(User.role == "user")
        .order_by(User.id.asc())
        .limit(BROADCAST_USER_LIMIT)
        .all()
    )
    for user in users:
        try:
            prefs = get_or_create_prefs(db, user.id)
            if not prefs.notify_signal or not prefs.email_realtime:
                continue
            if not try_consume_realtime_slot(db, user.id):
                continue
            notify_user(db, user.id, NotificationType.NEW_SIGNAL, content[:2000])
            seg = user_segment_label(db, user)
            subj, body = render_signal_alert_plain(
                user.name or "there",
                seg,
                signal.token_symbol,
                signal.signal_type,
                signal.title,
                nc,
            )
            send_logged_email(
                db,
                user=user,
                template_key="alert_signal",
                subject=subj,
                body=body,
            )
            db.commit()
        except Exception:
            logger.exception("dispatch_signal user_id=%s", user.id)
            db.rollback()


def dispatch_narrative_shift(
    db: Session,
    *,
    narrative_name: str,
    growth_text: str,
) -> None:
    content = f"Narrative shift: {narrative_name} — {growth_text}"
    users = (
        db.query(User)
        .filter(User.is_active.is_(True))
        .filter(User.role == "user")
        .order_by(User.id.asc())
        .limit(BROADCAST_USER_LIMIT)
        .all()
    )
    for user in users:
        try:
            prefs = get_or_create_prefs(db, user.id)
            if not prefs.notify_narrative or not prefs.email_realtime:
                continue
            if not try_consume_realtime_slot(db, user.id):
                continue
            notify_user(db, user.id, NotificationType.NARRATIVE_SHIFT, content[:2000])
            seg = user_segment_label(db, user)
            subj, body = render_narrative_shift_plain(user.name or "there", narrative_name, growth_text)
            send_logged_email(
                db,
                user=user,
                template_key="alert_narrative_shift",
                subject=subj,
                body=body,
            )
            db.commit()
        except Exception:
            logger.exception("dispatch_narrative user_id=%s", user.id)
            db.rollback()


def run_daily_digest_for_user(db: Session, user: User) -> bool:
    prefs = get_or_create_prefs(db, user.id)
    if not prefs.email_digest:
        return False
    today = datetime.now(timezone.utc).date()
    dedupe = f"digest:{user.id}:{today.isoformat()}"
    if db.query(EmailSendLog).filter(EmailSendLog.dedupe_key == dedupe).first():
        return False
    payload = generate_daily_digest(db)
    seg = user_segment_label(db, user)
    subj, body = render_daily_digest_plain(user.name or "there", seg, payload)
    return send_logged_email(
        db,
        user=user,
        template_key="digest_daily",
        subject=subj,
        body=body,
        dedupe_key=dedupe,
        digest_utc_date=today,
    )


def run_daily_digest_all_users(db: Session) -> int:
    users = db.query(User).filter(User.is_active.is_(True), User.role == "user").all()
    n = 0
    for user in users:
        try:
            if run_daily_digest_for_user(db, user):
                n += 1
            db.commit()
        except Exception:
            logger.exception("digest user_id=%s", user.id)
            db.rollback()
    return n


def run_trial_reminders(db: Session) -> int:
    now = datetime.now(timezone.utc)
    n = 0
    users = db.query(User).filter(User.is_active.is_(True), User.trial_end.isnot(None)).all()
    for user in users:
        te = user.trial_end
        if te is None:
            continue
        end = te if te.tzinfo else te.replace(tzinfo=timezone.utc)
        if end <= now:
            continue
        days_left = max(0, (end - now).days)
        if days_left not in (1, 3, 7):
            continue
        prefs = get_or_create_prefs(db, user.id)
        if not prefs.notify_trial:
            continue
        dedupe = f"trial_reminder:{user.id}:{days_left}:{end.date().isoformat()}"
        if db.query(EmailSendLog).filter(EmailSendLog.dedupe_key == dedupe).first():
            continue
        subj, body = render_trial_expiring_plain(user.name or "there", days_left)
        notify_user(db, user.id, "trial_expiring", subj)
        send_logged_email(
            db,
            user=user,
            template_key="trial_expiring",
            subject=subj,
            body=body,
            dedupe_key=dedupe,
        )
        db.commit()
        n += 1
    return n


def run_reengagement(db: Session, *, inactive_days: int = 14) -> int:
    now = datetime.now(timezone.utc)
    cutoff = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    from datetime import timedelta

    cutoff = cutoff - timedelta(days=inactive_days)
    n = 0
    users = (
        db.query(User)
        .filter(User.is_active.is_(True), User.role == "user")
        .filter((User.last_seen_at.is_(None)) | (User.last_seen_at < cutoff))
        .limit(500)
        .all()
    )
    for user in users:
        prefs = get_or_create_prefs(db, user.id)
        if not prefs.notify_reengage or not prefs.email_marketing:
            continue
        y, w, _ = now.isocalendar()
        dedupe = f"reengage:{user.id}:{y}W{w:02d}"
        if db.query(EmailSendLog).filter(EmailSendLog.dedupe_key == dedupe).first():
            continue
        seg = user_segment_label(db, user)
        subj, body = render_reengage_plain(user.name or "there", seg)
        notify_user(db, user.id, "user_inactive", subj)
        send_logged_email(
            db,
            user=user,
            template_key="reengage",
            subject=subj,
            body=body,
            dedupe_key=dedupe,
        )
        db.commit()
        n += 1
    return n
