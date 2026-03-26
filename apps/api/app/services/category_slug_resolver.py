"""
Map CoinGecko coin `categories[]` strings to official category_id slugs from
`/coins/categories/list` so web can link to /discover/{category_id}.
"""

from __future__ import annotations

import logging
import re
import time
from typing import List, Optional, Tuple

from app.services.connectors.coingecko_connector import _get

logger = logging.getLogger(__name__)

_CACHE_INDEX: dict | None = None
_CACHE_AT = 0.0
TTL_SEC = 86_400
DEFAULT_FALLBACK_SLUG = "smart-contract-platform"


def _normalize_label(name: str) -> str:
    s = re.sub(r"\s*\([^)]*\)\s*", " ", name)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def _load_index() -> dict:
    """Build { exact_lower: id, norm: id } from CoinGecko categories list."""
    global _CACHE_INDEX, _CACHE_AT
    now = time.time()
    if _CACHE_INDEX is not None and now - _CACHE_AT < TTL_SEC:
        return _CACHE_INDEX

    exact: dict[str, str] = {}
    normalized: dict[str, str] = {}
    try:
        raw = _get("/coins/categories/list")
        for item in raw or []:
            cid = (item.get("category_id") or item.get("id") or "").strip()
            name = (item.get("name") or "").strip()
            if not cid or not name:
                continue
            exact[name.lower()] = cid
            n = _normalize_label(name)
            if n and n not in normalized:
                normalized[n] = cid
    except Exception as e:
        logger.warning("category list fetch failed: %s", e)

    _CACHE_INDEX = {"exact": exact, "normalized": normalized, "ids": set(exact.values())}
    _CACHE_AT = now
    return _CACHE_INDEX


def resolve_primary_category(
    categories: List[str],
) -> Tuple[Optional[str], Optional[str]]:
    """
    Pick display name + CoinGecko category_id slug for the primary category.

    Returns (display_name, category_id_slug). Slug may be None if list API
    failed; caller may apply DEFAULT_FALLBACK_SLUG.
    """
    if not categories:
        return None, None
    idx = _load_index()
    exact = idx.get("exact") or {}
    normalized = idx.get("normalized") or {}

    for cat in categories:
        if not cat or not str(cat).strip():
            continue
        raw = str(cat).strip()
        low = raw.lower()
        if low in exact:
            return raw, exact[low]
        n = _normalize_label(raw)
        if n in normalized:
            return raw, normalized[n]

    # No API map: first label only
    first = next((c.strip() for c in categories if c and str(c).strip()), None)
    return first, None


def ensure_slug(slug: Optional[str]) -> str:
    if slug and str(slug).strip():
        return str(slug).strip()
    return DEFAULT_FALLBACK_SLUG


def slugify_display_label(label: str) -> str:
    """Stable slug when CoinGecko categories list has no mapping (lowercase, hyphenated)."""
    s = re.sub(r"[^a-z0-9]+", "-", _normalize_label(label).replace(" ", "-"))
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "uncategorized"


def resolve_all_category_tags(
    categories: List[str],
) -> List[Tuple[str, str]]:
    """
    Map CoinGecko `categories[]` strings to [(display_name, category_id_slug), ...].
    Order preserved; duplicate slugs dropped (first wins).
    """
    if not categories:
        return []
    idx = _load_index()
    exact = idx.get("exact") or {}
    normalized = idx.get("normalized") or {}

    seen: set[str] = set()
    out: List[Tuple[str, str]] = []
    for cat in categories:
        if not cat or not str(cat).strip():
            continue
        raw = str(cat).strip()
        low = raw.lower()
        slug: Optional[str] = None
        if low in exact:
            slug = exact[low]
        else:
            n = _normalize_label(raw)
            if n in normalized:
                slug = normalized[n]
            else:
                slug = slugify_display_label(raw)
        if not slug or slug in seen:
            continue
        seen.add(slug)
        out.append((raw, slug))
    return out
