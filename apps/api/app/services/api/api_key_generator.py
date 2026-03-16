"""
Generate secure API keys and verify against stored hashes.
Keys are long random strings; only the hash is stored in the database.
"""

from __future__ import annotations

import hashlib
import secrets
from typing import Tuple

from sqlalchemy.orm import Session

from app.models import ApiKey, User

KEY_PREFIX = "bk70_"
KEY_BYTES = 32
PREFIX_DISPLAY_LEN = 8


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def hash_api_key(raw_key: str) -> str:
    """Return SHA-256 hash of the raw API key for storage."""
    return _hash_key(raw_key)


def generate_api_key(
    db: Session,
    user_id: int,
    plan_type: str = "free",
    rate_limit: int | None = None,
) -> Tuple[ApiKey, str]:
    """
    Create a new API key for the user. Returns (ApiKey model, raw_key string).
    The raw key is only returned once; store it securely.
    """
    from app.services.api.rate_limit_engine import RATE_LIMITS

    raw_key = KEY_PREFIX + secrets.token_urlsafe(KEY_BYTES)
    key_hash = _hash_key(raw_key)
    prefix = raw_key[:PREFIX_DISPLAY_LEN] if len(raw_key) >= PREFIX_DISPLAY_LEN else raw_key[:6]

    limit = rate_limit
    if limit is None:
        limit = RATE_LIMITS.get(plan_type, 100)

    api_key = ApiKey(
        user_id=user_id,
        api_key_hash=key_hash,
        key_prefix=prefix,
        plan_type=plan_type,
        rate_limit=limit,
        is_active=True,
    )
    db.add(api_key)
    db.flush()
    return api_key, raw_key


def verify_api_key(db: Session, raw_key: str) -> ApiKey | None:
    """
    Verify raw key against stored hashes. Returns ApiKey if valid and active, else None.
    """
    if not raw_key or not raw_key.startswith(KEY_PREFIX):
        return None
    key_hash = _hash_key(raw_key)
    api_key = (
        db.query(ApiKey)
        .filter(
            ApiKey.api_key_hash == key_hash,
            ApiKey.is_active == True,
        )
        .first()
    )
    return api_key
