"""
Authenticate requests using API keys (X-API-Key header).
Validates key, plan permissions, and rate limits.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ApiKey, User
from app.services.api.api_key_generator import verify_api_key
from app.services.api.rate_limit_engine import check_rate_limit, record_usage


async def get_api_key_header(x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None) -> str | None:
    """Extract X-API-Key from header."""
    return x_api_key


def get_api_key(
    x_api_key: str | None = Depends(get_api_key_header),
    db: Session = Depends(get_db),
) -> ApiKey:
    """
    Validate API key and return the ApiKey model. Raises 401 if missing or invalid.
    Does not check rate limit (caller or middleware should record usage and check limit).
    """
    if not x_api_key or not x_api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header",
        )
    api_key = verify_api_key(db, x_api_key.strip())
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
        )
    return api_key


def get_api_key_user(
    api_key: ApiKey = Depends(get_api_key),
    db: Session = Depends(get_db),
) -> tuple[ApiKey, User]:
    """Return (ApiKey, User) for valid API key. Use for endpoints that require API key auth."""
    user = db.get(User, api_key.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return api_key, user


def require_rate_limit(
    request: Request,
    api_key: ApiKey = Depends(get_api_key),
    db: Session = Depends(get_db),
) -> ApiKey:
    """
    Dependency that checks rate limit before allowing the request.
    Call after get_api_key. Raises 429 if over limit.
    Stores request path for usage recording; caller should call record_usage_after or we do it in a middleware.
    """
    allowed, current, limit = check_rate_limit(db, api_key)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Usage: {current}/{limit} requests today.",
            headers={"X-RateLimit-Limit": str(limit), "X-RateLimit-Remaining": "0"},
        )
    return api_key


def record_usage_after(api_key: ApiKey, endpoint: str, db: Session) -> None:
    """Record one API usage and update last_used. Call at end of request."""
    record_usage(db, api_key.id, endpoint)
    api_key.last_used = datetime.now(timezone.utc)
    db.add(api_key)
    db.flush()


def api_key_auth_dependency(
    api_key: ApiKey = Depends(get_api_key),
    db: Session = Depends(get_db),
) -> tuple[ApiKey, User]:
    """
    Single dependency for API-key-protected routes: validates key, checks rate limit, returns (ApiKey, User).
    Usage is recorded by the route (pass endpoint path) or by middleware.
    """
    user = db.get(User, api_key.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    allowed, current, limit = check_rate_limit(db, api_key)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Usage: {current}/{limit} requests today.",
            headers={"X-RateLimit-Limit": str(limit), "X-RateLimit-Remaining": "0"},
        )
    return api_key, user
