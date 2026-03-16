"""
Webhook delivery: send POST requests to registered URLs when events occur.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import requests

from sqlalchemy.orm import Session

from app.models import Webhook


EVENT_NEW_SIGNAL = "new_signal"
EVENT_WALLET_TRADE = "wallet_trade"
EVENT_OPPORTUNITY_ALERT = "opportunity_alert"


def get_webhooks_for_event(db: Session, event_type: str) -> list[Webhook]:
    """Return active webhooks subscribed to this event type."""
    return (
        db.query(Webhook)
        .filter(Webhook.event_type == event_type)
        .all()
    )


def deliver_webhook_sync(url: str, payload: dict[str, Any], timeout: int = 10) -> tuple[bool, int, str]:
    """
    Send POST request to webhook URL. Returns (success, status_code, body_or_error).
    """
    try:
        r = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json", "User-Agent": "Block70-Webhook/1.0"},
            timeout=timeout,
        )
        return True, r.status_code, r.text[:500] if r.text else ""
    except Exception as e:
        return False, 0, str(e)


def deliver_webhooks_for_event(
    db: Session,
    event_type: str,
    payload: dict[str, Any],
) -> list[dict]:
    """
    Load webhooks for event_type and POST payload to each URL.
    Returns list of {url, success, status_code, message}.
    """
    webhooks = get_webhooks_for_event(db, event_type)
    results = []
    for wh in webhooks:
        success, code, msg = deliver_webhook_sync(wh.url, payload)
        results.append({
            "url": wh.url,
            "success": success,
            "status_code": code,
            "message": msg,
        })
    return results


def notify_new_signal(db: Session, signal_id: int, token_symbol: str | None, signal_type: str, confidence: float) -> list[dict]:
    """Trigger webhooks for new_signal event."""
    payload = {
        "event": EVENT_NEW_SIGNAL,
        "signal_id": signal_id,
        "token_symbol": token_symbol,
        "signal_type": signal_type,
        "confidence_score": confidence,
    }
    return deliver_webhooks_for_event(db, EVENT_NEW_SIGNAL, payload)


def notify_opportunity_alert(db: Session, opportunity_id: int, title: str, opportunity_type: str, score: float) -> list[dict]:
    """Trigger webhooks for opportunity_alert event."""
    payload = {
        "event": EVENT_OPPORTUNITY_ALERT,
        "opportunity_id": opportunity_id,
        "title": title,
        "type": opportunity_type,
        "total_score": score,
    }
    return deliver_webhooks_for_event(db, EVENT_OPPORTUNITY_ALERT, payload)
