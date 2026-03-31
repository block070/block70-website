"""Optional fetch of Crypto-on-the-hour JSON from the Next.js app."""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from app.services.connectors.market_cache import market_cache_get, market_cache_set

logger = logging.getLogger(__name__)

_CHICAGO = ZoneInfo("America/Chicago")
_HOUR_CACHE_TTL = 120
_HOUR_TYP = "ai_intel_hour_intel"
_FETCH_TIMEOUT = 0.8


def now_chicago_wall_parts(when: datetime | None = None) -> tuple[int, int, int, int]:
    dt = when or datetime.now(_CHICAGO)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_CHICAGO)
    else:
        dt = dt.astimezone(_CHICAGO)
    return (dt.year, dt.month, dt.day, dt.hour)


def _base_url() -> str | None:
    for key in ("INTERNAL_WEB_BASE_URL", "NEXT_PUBLIC_SITE_URL"):
        raw = (os.getenv(key) or "").strip()
        if raw:
            return raw.rstrip("/")
    return None


def fetch_hour_intelligence_payload_cached(
    *,
    when: datetime | None = None,
) -> dict[str, Any] | None:
    if not _base_url():
        return None
    y, mo, d, h = now_chicago_wall_parts(when)
    cached = market_cache_get(_HOUR_TYP, _HOUR_CACHE_TTL, year=y, month=mo, day=d, hour=h)
    if isinstance(cached, dict):
        if cached.get("err"):
            return None
        data = cached.get("data")
        if isinstance(data, dict):
            return data

    payload = _fetch_hour_intel_http(y, mo, d, h)
    if payload is None:
        market_cache_set(_HOUR_TYP, 30, {"err": True}, year=y, month=mo, day=d, hour=h)
        return None
    market_cache_set(
        _HOUR_TYP,
        _HOUR_CACHE_TTL,
        {"data": payload},
        year=y,
        month=mo,
        day=d,
        hour=h,
    )
    return payload


def _fetch_hour_intel_http(year: int, month: int, day: int, hour: int) -> dict[str, Any] | None:
    base = _base_url()
    if not base:
        return None
    url = f"{base}/api/crypto-on-the-hour/intelligence"
    secret = (os.getenv("CRYPTO_HOUR_INTEL_SECRET") or "").strip()
    headers: dict[str, str] = {}
    if secret:
        headers["X-Crypto-Hour-Intel-Secret"] = secret
    try:
        with httpx.Client(timeout=_FETCH_TIMEOUT) as client:
            r = client.get(
                url,
                params={"year": year, "month": month, "day": day, "hour": hour},
                headers=headers,
            )
        if r.status_code != 200:
            logger.debug("hour intel HTTP %s: %s", r.status_code, r.text[:200])
            return None
        data = r.json()
        return data if isinstance(data, dict) else None
    except Exception as e:
        logger.debug("hour intel fetch failed: %s", e)
        return None


def hour_sentiment_to_0_100(hour_sentiment: Any) -> float:
    try:
        s = float(hour_sentiment)
    except (TypeError, ValueError):
        return 50.0
    s = max(-100.0, min(100.0, s))
    return (s + 100.0) / 2.0


def hour_summary_lines(payload: dict[str, Any] | None) -> list[str]:
    if not payload:
        return []
    summaries = payload.get("summaries")
    if not isinstance(summaries, dict):
        return []
    quick = summaries.get("quick")
    if isinstance(quick, list) and quick:
        return [str(x).strip() for x in quick[:3] if str(x).strip()]
    trader = summaries.get("trader")
    if isinstance(trader, str) and trader.strip():
        return [trader.strip()[:500]]
    return []
