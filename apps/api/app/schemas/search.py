"""Search API schemas for unified search across coins, news, and static routes."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, Union

from pydantic import BaseModel, Field


SearchCategory = Literal["coins", "news", "wallets", "airdrops", "signals", "narratives"]


class SearchResultCoins(BaseModel):
    """Coin search result with optional intelligence fields (Phase 4)."""

    id: str
    category: Literal["coins"] = "coins"
    title: str
    subtitle: Optional[str] = None
    href: str
    price_change_24h: Optional[float] = None
    trending_rank: Optional[int] = None
    signal_count_24h: Optional[int] = None


class SearchResultNews(BaseModel):
    """News article search result."""

    id: str
    category: Literal["news"] = "news"
    title: str
    subtitle: Optional[str] = None
    href: str
    source: Optional[str] = None
    published_at: Optional[datetime] = None
    score: Optional[float] = None


class SearchResultStatic(BaseModel):
    """Static route (signals, airdrops, wallets, narratives) search result."""

    id: str
    category: Literal["wallets", "airdrops", "signals", "narratives"]
    title: str
    subtitle: Optional[str] = None
    href: str


SearchResultItem = Union[SearchResultCoins, SearchResultNews, SearchResultStatic]


class SearchResponse(BaseModel):
    """Unified search response."""

    q: str
    results: list[
        SearchResultCoins | SearchResultNews | SearchResultStatic
    ] = Field(default_factory=list)
