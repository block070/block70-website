"""
Authenticate requests using API keys (X-API-Key header).
Validates key, scopes, IP allowlist, plan permissions, and rate limits.
Usage is logged by DevApiUsageLoggingMiddleware for /api/v1/dev routes.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ApiKey, User
from app.services.api.api_key_generator import verify_api_key
from app.services.api.api_key_policies import enforce_api_key_access
from app.services.api.rate_limit_engine import check_rate_limit


async def get_api_key_header(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> str | None:
    """Extract X-API-Key from header."""
    return x_api_key


def get_api_key(
    x_api_key: str | None = Depends(get_api_key_header),
    db: Session = Depends(get_db),
) -> ApiKey:
    """
    Validate API key and return the ApiKey model. Raises 401 if missing or invalid.
    Does not check rate limit, IP, or scopes (use api_key_auth_dependency for /dev API).
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
    api_key: ApiKey = Depends(get_api_key),
    db: Session = Depends(get_db),
) -> ApiKey:
    """Raises 429 if over daily limit."""
    allowed, current, limit = check_rate_limit(db, api_key)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Usage: {current}/{limit} requests today.",
            headers={"X-RateLimit-Limit": str(limit), "X-RateLimit-Remaining": "0"},
        )
    return api_key


def record_usage_after(api_key: ApiKey, endpoint: str, db: Session) -> None:
    """Deprecated for /api/v1/dev — middleware records usage with HTTP status."""
    from app.services.api.rate_limit_engine import record_usage

    record_usage(db, api_key.id, endpoint, status_code=200)


def api_key_auth_dependency(
    request: Request,
    x_api_key: str | None = Depends(get_api_key_header),
    db: Session = Depends(get_db),
) -> tuple[ApiKey, User]:
    """
    For developer API routes: full validation + marks request for usage logging.
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
    user = db.get(User, api_key.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    enforce_api_key_access(request, api_key, db)

    allowed, current, limit = check_rate_limit(db, api_key)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Usage: {current}/{limit} requests today.",
            headers={"X-RateLimit-Limit": str(limit), "X-RateLimit-Remaining": "0"},
        )

    request.state.api_usage_key_id = api_key.id
    return api_key, user
