from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

ALPHA_TYPES = ("trade_idea", "signal", "strategy", "research")
VOTE_TYPES = ("up", "down")


class AlphaPostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    title: str
    content: str
    token_symbol: Optional[str]
    chain: Optional[str]
    alpha_type: str
    confidence_score: float
    created_at: datetime
    updated_at: datetime
    author_name: Optional[str] = None
    vote_score: Optional[int] = None
    comment_count: Optional[int] = None


class AlphaPostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    token_symbol: Optional[str] = Field(None, max_length=32)
    chain: Optional[str] = Field(None, max_length=32)
    alpha_type: str = Field(..., pattern="^(trade_idea|signal|strategy|research)$")
    confidence_score: float = Field(0.0, ge=0.0, le=1.0)


class AlphaCommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    post_id: int
    user_id: int
    content: str
    created_at: datetime
    author_name: Optional[str] = None


class AlphaCommentCreate(BaseModel):
    post_id: int
    content: str = Field(..., min_length=1)


class AlphaVoteCreate(BaseModel):
    post_id: int
    vote_type: str = Field(..., pattern="^(up|down)$")


class UserReputationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: int
    reputation_score: float
    alpha_accuracy: float
    followers: int
