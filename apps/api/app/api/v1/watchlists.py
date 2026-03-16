from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Opportunity, Watchlist, WatchlistItem
from app.schemas.watchlist import (
    WatchlistCreate,
    WatchlistRead,
    WatchlistItemCreate,
    WatchlistItemRead,
)


router = APIRouter(prefix="/api/v1/watchlists", tags=["watchlists"])


@router.post("", response_model=WatchlistRead, status_code=status.HTTP_201_CREATED)
def create_watchlist(
    payload: WatchlistCreate,
    db: Session = Depends(get_db),
) -> Watchlist:
    watchlist = Watchlist(
        user_identifier=payload.user_identifier,
        name=payload.name,
    )
    db.add(watchlist)
    db.commit()
    db.refresh(watchlist)
    return watchlist


@router.get("", response_model=List[WatchlistRead])
def list_watchlists(
    user_identifier: Optional[str] = Query(
        default=None,
        description="Optionally filter watchlists by user identifier",
    ),
    db: Session = Depends(get_db),
) -> List[Watchlist]:
    query = db.query(Watchlist)
    if user_identifier:
        query = query.filter(Watchlist.user_identifier == user_identifier)
    return query.order_by(Watchlist.created_at.desc()).all()


@router.post(
    "/{watchlist_id}/items",
    response_model=WatchlistItemRead,
    status_code=status.HTTP_201_CREATED,
)
def add_watchlist_item(
    watchlist_id: int = Path(..., description="ID of the watchlist"),
    payload: WatchlistItemCreate = ...,
    db: Session = Depends(get_db),
) -> WatchlistItem:
    watchlist = db.get(Watchlist, watchlist_id)
    if watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    opportunity = db.get(Opportunity, payload.opportunity_id)
    if opportunity is None:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    item = WatchlistItem(
        watchlist_id=watchlist.id,
        opportunity_id=opportunity.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete(
    "/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_watchlist_item(
    item_id: int = Path(..., description="ID of the watchlist item"),
    db: Session = Depends(get_db),
) -> None:
    item = db.get(WatchlistItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Watchlist item not found")

    db.delete(item)
    db.commit()
    return None

