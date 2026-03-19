from __future__ import annotations

import hashlib
import time
from typing import Optional

import requests

from .cache import news_fetch_cache


class FetchError(RuntimeError):
    pass


def cached_get_text(
    url: str,
    *,
    ttl_seconds: int = 180,
    timeout_seconds: float = 8.0,
    retries: int = 2,
    headers: Optional[dict[str, str]] = None,
) -> tuple[str, bool]:
    cache_key = hashlib.sha256(f"text::{url}".encode("utf-8")).hexdigest()
    cached = news_fetch_cache.get(cache_key)
    if cached is not None:
        return cached, True

    last_error: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            response = requests.get(url, timeout=timeout_seconds, headers=headers)
            response.raise_for_status()
            text = response.text
            news_fetch_cache.set(cache_key, text, ttl_seconds)
            return text, False
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt < retries:
                time.sleep(0.25 * (attempt + 1))
    raise FetchError(str(last_error) if last_error else "unknown fetch error")


def cached_get_json(
    url: str,
    *,
    ttl_seconds: int = 180,
    timeout_seconds: float = 8.0,
    retries: int = 2,
    headers: Optional[dict[str, str]] = None,
) -> tuple[dict, bool]:
    cache_key = hashlib.sha256(f"json::{url}".encode("utf-8")).hexdigest()
    cached = news_fetch_cache.get(cache_key)
    if cached is not None:
        return cached, True

    last_error: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            response = requests.get(url, timeout=timeout_seconds, headers=headers)
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                raise FetchError("json response was not an object")
            news_fetch_cache.set(cache_key, data, ttl_seconds)
            return data, False
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt < retries:
                time.sleep(0.25 * (attempt + 1))
    raise FetchError(str(last_error) if last_error else "unknown fetch error")
