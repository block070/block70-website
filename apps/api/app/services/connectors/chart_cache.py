"""
Chart cache for CoinGecko market_chart data.

Uses Redis when available for persistence and multi-instance sharing.
Falls back to in-memory cache when Redis is unavailable.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

from app.services.news.cache import TTLCache

logger = logging.getLogger(__name__)

_CHART_PREFIX = "block70:chart:"
_REDIS_CLIENT: Optional[Any] = None


def _get_redis():
    """Lazily create Redis client. Returns None if Redis unavailable."""
    global _REDIS_CLIENT
    if _REDIS_CLIENT is not None and _REDIS_CLIENT is not False:
        return _REDIS_CLIENT
    try:
        import redis
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _REDIS_CLIENT = redis.Redis.from_url(url, decode_responses=True)
        _REDIS_CLIENT.ping()
        return _REDIS_CLIENT
    except Exception as e:
        logger.debug("Redis unavailable for chart cache: %s", e)
        _REDIS_CLIENT = False  # Mark as attempted
        return None


_memory_cache = TTLCache()
_stale_fallback: dict[str, dict[str, Any]] = {}


def get_chart_ttl(days_param: str | int) -> int:
    """Return cache TTL in seconds based on chart range."""
    if days_param == "max" or (isinstance(days_param, int) and days_param > 90):
        return 3600
    if isinstance(days_param, int):
        if days_param <= 1:
            return 120
        if days_param <= 7:
            return 300
        if days_param <= 30:
            return 900
        return 1800
    return 3600


def chart_cache_get(key: str) -> Optional[dict[str, Any]]:
    """Get chart data from cache. Tries Redis first, then memory."""
    r = _get_redis()
    if r:
        try:
            raw = r.get(_CHART_PREFIX + key)
            if raw:
                return json.loads(raw)
        except Exception as e:
            logger.debug("Redis chart get failed: %s", e)
    return _memory_cache.get(key)


def chart_cache_set(key: str, data: dict[str, Any], ttl_seconds: int) -> None:
    """Store chart data. Writes to Redis + memory. Also updates stale fallback."""
    _stale_fallback[key] = data
    _memory_cache.set(key, data, ttl_seconds)
    r = _get_redis()
    if r:
        try:
            payload = json.dumps(data, separators=(",", ":"))
            r.setex(_CHART_PREFIX + key, ttl_seconds, payload)
            r.setex(_CHART_PREFIX + key + ":stale", 86400 * 7, payload)  # 7-day stale for 429
        except Exception as e:
            logger.debug("Redis chart set failed: %s", e)


def chart_cache_get_stale(key: str) -> Optional[dict[str, Any]]:
    """Get stale fallback (last known good). Used on 429."""
    r = _get_redis()
    if r:
        try:
            raw = r.get(_CHART_PREFIX + key + ":stale")
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    return _stale_fallback.get(key)
