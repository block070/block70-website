from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TokenWatchCreate(BaseModel):
    user_identifier: str
    token_symbol: str


class TokenWatchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_identifier: str
    token_symbol: str
    created_at: datetime

