from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class WatchlistCreate(BaseModel):
    user_identifier: str
    name: str


class WatchlistRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_identifier: str
    name: str
    created_at: datetime


class WatchlistItemCreate(BaseModel):
    opportunity_id: int


class WatchlistItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    watchlist_id: int
    opportunity_id: int
    created_at: datetime

