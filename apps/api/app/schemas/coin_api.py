from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


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


class PlatformContract(BaseModel):
    """Multi-chain contract (CoinGecko `platforms` map)."""

    platform_id: str
    contract_address: str


class CoinMarketExtras(BaseModel):
    """
    CoinGecko-style stats beyond the hero row: ATH/ATL, supply, FDV, contracts.
    Populated from /coins/{id} when available (single API call with existing enrichment).
    """

    ath_usd: Optional[float] = None
    ath_change_pct_vs_current: Optional[float] = None
    ath_date: Optional[datetime] = None
    atl_usd: Optional[float] = None
    atl_change_pct_vs_current: Optional[float] = None
    atl_date: Optional[datetime] = None
    max_supply: Optional[float] = None
    fully_diluted_valuation_usd: Optional[float] = None
    platforms: List[PlatformContract] = Field(default_factory=list)


class CoinInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    symbol: str
    slug: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    whitepaper_url: Optional[str] = None
    explorer_url: Optional[str] = None
    twitter: Optional[str] = None
    discord: Optional[str] = None
    telegram: Optional[str] = None
    chain: Optional[str] = None
    category: Optional[str] = None
    category_slug: Optional[str] = None
    market_cap_rank: Optional[int] = None
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
    market_extras: Optional[CoinMarketExtras] = None


class CoinListItem(BaseModel):
    coin: CoinInfo
    latest_market_data: Optional[MarketDataPoint] = None

