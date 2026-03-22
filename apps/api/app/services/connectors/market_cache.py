"""
Redis cache for market data (coins, trending).

- Coins: 30s TTL (fresh prices)
- Trending: 5 min TTL
Falls back to in-memory when Redis unavailable.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)

_PREFIX = "block70:market:"
_REDIS_CLIENT: Optional[Any] = None

# In-memory fallback when Redis down
_memory: dict[str, tuple[Any, float]] = {}
_MEMORY_TTL = {"coins": 30, "trending": 300}


def _get_redis():
    """Lazily create Redis client. Returns None if unavailable."""
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
        logger.debug("Redis unavailable for market cache: %s", e)
        _REDIS_CLIENT = False
        return None


def _cache_key(typ: str, **params: Any) -> str:
    parts = [typ] + [f"{k}={v}" for k, v in sorted(params.items())]
    return _PREFIX + ":".join(parts)


def market_cache_get(typ: str, default_ttl: int, **params: Any) -> Optional[Any]:
    """Get from cache. Tries Redis first, then memory."""
    key = _cache_key(typ, **params)
    r = _get_redis()
    if r:
        try:
            raw = r.get(key)
            if raw:
                return json.loads(raw)
        except Exception as e:
            logger.debug("Redis market get failed: %s", e)
    entry = _memory.get(key)
    if entry:
        data, ts = entry
        if time.time() - ts < default_ttl:
            return data
        del _memory[key]
    return None


def market_cache_set(typ: str, ttl: int, data: Any, **params: Any) -> None:
    """Store in cache. Writes to Redis + memory."""
    key = _cache_key(typ, **params)
    _memory[key] = (data, time.time())
    r = _get_redis()
    if r:
        try:
            payload = json.dumps(data, separators=(",", ":"))
            r.setex(key, ttl, payload)
        except Exception as e:
            logger.debug("Redis market set failed: %s", e)
