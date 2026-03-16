from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import TokenWatch
from app.schemas.token_watch import TokenWatchCreate, TokenWatchRead


router = APIRouter(prefix="/api/v1/token-watch", tags=["token-watch"])


@router.post("", response_model=TokenWatchRead, status_code=status.HTTP_201_CREATED)
def create_token_watch(
    payload: TokenWatchCreate,
    db: Session = Depends(get_db),
) -> TokenWatch:
    """
    Create a new token watch entry for a user.
    """
    watch = TokenWatch(
        user_identifier=payload.user_identifier,
        token_symbol=payload.token_symbol.upper(),
    )
    db.add(watch)
    db.commit()
    db.refresh(watch)
    return watch


@router.get("", response_model=List[TokenWatchRead])
def list_token_watches(
    user_identifier: Optional[str] = Query(
        default=None,
        description="Optionally filter token watches by user identifier",
    ),
    db: Session = Depends(get_db),
) -> List[TokenWatch]:
    """
    List token watches, optionally filtered by user_identifier.
    """
    query = db.query(TokenWatch)
    if user_identifier:
        query = query.filter(TokenWatch.user_identifier == user_identifier)
    return query.order_by(TokenWatch.created_at.desc()).all()

