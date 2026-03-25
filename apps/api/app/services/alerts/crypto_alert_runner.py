"""
Evaluate Block70 chart-pack rules for `Alert` rows with type `b70_crypto_v1`.

`conditions_json` shape:
{
  "version": 1,
  "coin_slugs": ["bitcoin", "ethereum"],
  "timeframe": "1h",
  "triggers": {
    "score_cross_above": 80,
    "score_cross_below": 40,
    "volume_spike_ratio": 1.5,
    "momentum_spike_abs": 0.05
  },
  "delivery": {
    "email": true,
    "telegram_chat_id": "123456"  // optional; uses TELEGRAM_ALERT_BOT_TOKEN or TELEGRAM_BOT_TOKEN
  }
}

Runs every few minutes from APScheduler; uses cached chart packs (Redis) when warm.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from sqlalchemy.orm import Session

from app.models import Alert, PlanType, User
from app.services.alerts.notifications import send_smtp_email, send_telegram_text
from app.services.charts.chart_pack_service import get_chart_pack_cached

logger = logging.getLogger(__name__)

B70_CRYPTO_ALERT_TYPE = "b70_crypto_v1"
_DEDUP_TTL_SEC = int(os.getenv("CRYPTO_ALERT_DEDUP_TTL_SEC", "2700"))
_REDIS_PREV_PREFIX = "b70:crypto_alert:prev:"
_REDIS_DEDUP_PREFIX = "b70:crypto_alert:dedup:"


def _redis_client():
    try:
        import redis

        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        r = redis.Redis.from_url(url, decode_responses=True)
        r.ping()
        return r
    except Exception:
        return None


def _telegram_token() -> str:
    return (
        os.getenv("TELEGRAM_ALERT_BOT_TOKEN", "").strip()
        or os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    )


def _maybe_skip_free_user(db: Session, user_identifier: str) -> bool:
    u = db.query(User).filter(User.email == user_identifier).first()
    if u is None:
        return False
    return u.plan_type == PlanType.FREE.value


def _fire_delivery(
    *,
    alert: Alert,
    slug: str,
    message: str,
    delivery: dict[str, Any],
) -> None:
    if delivery.get("email") and "@" in alert.user_identifier:
        ok, err = send_smtp_email(
            to_addr=alert.user_identifier,
            subject=f"Block70 alert · {slug}",
            body=message,
        )
        if not ok:
            logger.warning("alert %s email failed: %s", alert.id, err)
    chat_id = (delivery.get("telegram_chat_id") or "").strip()
    if chat_id:
        tok = _telegram_token()
        ok, err = send_telegram_text(bot_token=tok, chat_id=chat_id, text=f"<b>Block70</b>\n{message}")
        if not ok:
            logger.warning("alert %s telegram failed: %s", alert.id, err)


def _is_duplicate_delivery(r, alert_id: int, slug: str, tag: str) -> bool:
    """True if this (alert, slug, tag) was already alerted recently."""
    if r is None:
        return False
    key = f"{_REDIS_DEDUP_PREFIX}{alert_id}:{slug}:{tag}"
    try:
        created = bool(r.set(key, "1", nx=True, ex=_DEDUP_TTL_SEC))
        return not created
    except Exception as e:
        logger.debug("redis dedup: %s", e)
        return False


def _get_prev_score(r, alert_id: int, slug: str) -> float | None:
    key = f"{_REDIS_PREV_PREFIX}{alert_id}:{slug}"
    if r is None:
        return None
    try:
        raw = r.get(key)
        return float(raw) if raw is not None else None
    except Exception:
        return None


def _set_prev_score(r, alert_id: int, slug: str, score: float) -> None:
    key = f"{_REDIS_PREV_PREFIX}{alert_id}:{slug}"
    if r is None:
        return
    try:
        r.setex(key, 86400 * 3, str(score))
    except Exception as e:
        logger.debug("redis prev score: %s", e)


def _process_one_alert(db: Session, alert: Alert, r) -> None:
    cond = alert.conditions_json or {}
    if int(cond.get("version") or 0) != 1:
        return
    if _maybe_skip_free_user(db, alert.user_identifier):
        return
    slugs = [s.strip().lower() for s in (cond.get("coin_slugs") or []) if s and str(s).strip()]
    if not slugs:
        return
    tf = str(cond.get("timeframe") or "1h").lower().strip()
    trig = cond.get("triggers") or {}
    delivery = cond.get("delivery") or {}

    cross_above = trig.get("score_cross_above")
    cross_below = trig.get("score_cross_below")
    vol_thr = trig.get("volume_spike_ratio")
    mom_thr = trig.get("momentum_spike_abs")

    for slug in slugs:
        try:
            pack = get_chart_pack_cached(slug, tf, db=db)
        except ValueError:
            logger.debug("crypto alert skip bad tf %s for %s", tf, slug)
            continue
        except Exception as e:
            logger.warning("crypto alert pack %s %s: %s", slug, tf, e)
            continue
        ind = pack.get("indicators") or {}
        score_raw = ind.get("score")
        if not isinstance(score_raw, (int, float)):
            continue
        score = float(score_raw)
        vt = ind.get("volume_trend")
        mom = ind.get("momentum")
        signal = ind.get("signal") or ""

        prev = _get_prev_score(r, alert.id or 0, slug)

        messages: list[tuple[str, str]] = []
        if prev is not None and cross_above is not None:
            thr = float(cross_above)
            if prev < thr <= score:
                messages.append(
                    (
                        f"score_cross_above_{int(thr)}",
                        f"{slug} ({tf}): Block70 score crossed above {thr:g} (now {score:.1f}). Signal: {signal}",
                    )
                )
        if prev is not None and cross_below is not None:
            thr = float(cross_below)
            if prev > thr >= score:
                messages.append(
                    (
                        f"score_cross_below_{int(thr)}",
                        f"{slug} ({tf}): Block70 score crossed below {thr:g} (now {score:.1f}). Signal: {signal}",
                    )
                )
        if vol_thr is not None and isinstance(vt, (int, float)):
            if float(vt) >= float(vol_thr):
                messages.append(
                    (
                        f"vol_spike_{vol_thr}",
                        f"{slug} ({tf}): volume trend {float(vt):.2f}× (threshold {float(vol_thr):g}). Score {score:.1f}",
                    )
                )
        if mom_thr is not None and isinstance(mom, (int, float)):
            if abs(float(mom)) >= float(mom_thr):
                messages.append(
                    (
                        f"mom_spike_{mom_thr}",
                        f"{slug} ({tf}): 7-bar momentum {float(mom)*100:.2f}% (abs threshold {float(mom_thr)*100:g}%). Score {score:.1f}",
                    )
                )

        for tag, msg in messages:
            if _is_duplicate_delivery(r, alert.id or 0, slug, tag):
                continue
            logger.info("crypto alert %s %s: %s", alert.id, slug, msg)
            _fire_delivery(alert=alert, slug=slug, message=msg, delivery=delivery)

        _set_prev_score(r, alert.id or 0, slug, score)


def run_crypto_alerts(db: Session) -> None:
    r = _redis_client()
    alerts = (
        db.query(Alert)
        .filter(Alert.is_active == True, Alert.type == B70_CRYPTO_ALERT_TYPE)  # noqa: E712
        .all()
    )
    for a in alerts:
        try:
            _process_one_alert(db, a, r)
        except Exception:
            logger.exception("crypto alert failed id=%s", a.id)
