"""
User notifications API.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import User, UserNotification

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("", response_model=List[dict])
def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> List[dict]:
    """List notifications for the current user (newest first)."""
    rows = (
        db.query(UserNotification)
        .filter(UserNotification.user_id == current_user.id)
        .order_by(UserNotification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": n.id,
            "notification_type": n.notification_type,
            "content": n.content,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in rows
    ]
