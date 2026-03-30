"""Lightweight current-user maintenance (activity ping)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import User

router = APIRouter(prefix="/api/v1/me", tags=["me"])


@router.post("/ping")
def ping_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Update last_seen_at for retention and re-engagement jobs."""
    current_user.last_seen_at = datetime.now(timezone.utc)
    db.add(current_user)
    db.commit()
    return {"ok": True}
