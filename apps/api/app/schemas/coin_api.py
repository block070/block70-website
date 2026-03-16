from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class MarketDataPoint(BaseModel):
    timestamp: datetime
    price: float
    market_cap: Optional[float] = None
    volume_24h: Optional[float] = None
    price_change_24h: Optional[float] = None
    price_change_7d: Optional[float] = None


class NarrativeRead(BaseModel):
    name: str
    description: Optional[str] = None
    confidence_score: float


class NewsArticleRead(BaseModel):
    title: str
    source: str
    url: str
    summary: Optional[str] = None
    published_at: Optional[datetime] = None


class CoinInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    symbol: str
    slug: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    twitter: Optional[str] = None
    discord: Optional[str] = None
    chain: Optional[str] = None
    category: Optional[str] = None
    market_cap: Optional[float] = None
    price: Optional[float] = None
    volume_24h: Optional[float] = None
    circulating_supply: Optional[float] = None
    total_supply: Optional[float] = None


class CoinDetailResponse(BaseModel):
    coin: CoinInfo
    market_data: List[MarketDataPoint]
    narratives: List[NarrativeRead]
    news: List[NewsArticleRead]


class CoinListItem(BaseModel):
    coin: CoinInfo
    latest_market_data: Optional[MarketDataPoint] = None

