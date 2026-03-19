from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0


class TTLCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._store: dict[str, tuple[float, Any]] = {}
        self.stats = CacheStats()

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        with self._lock:
            item = self._store.get(key)
            if not item:
                self.stats.misses += 1
                return None
            expires_at, value = item
            if expires_at < now:
                self._store.pop(key, None)
                self.stats.misses += 1
                return None
            self.stats.hits += 1
            return value

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        expires_at = time.time() + ttl_seconds
        with self._lock:
            self._store[key] = (expires_at, value)


news_fetch_cache = TTLCache()
