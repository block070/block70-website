from __future__ import annotations

import time
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.models import Coin, MarketData
from app.services.connectors.coingecko_connector import fetch_coin_details

# CoinGecko free tier ~10-30 req/min. Delay between fetches to avoid rate limits.
FETCH_DELAY_SECONDS = float(__import__("os").getenv("COINGECKO_FETCH_DELAY", "2.0"))


class MarketDataPipeline:
    """
    Pipeline to refresh market data for all known coins.

    - For each Coin, fetch detail from CoinGecko
    - Insert a MarketData row
    - Update the Coin snapshot fields (price, market_cap, volume_24h, supplies)
    - Throttles requests to respect CoinGecko rate limits
    """

    def __init__(
        self,
        vs_currency: str = "usd",
        limit: int | None = None,
        delay_seconds: float = FETCH_DELAY_SECONDS,
    ) -> None:
        self.vs_currency = vs_currency
        self.limit = limit  # None = all coins; set to e.g. 50 for faster refresh of top coins
        self.delay_seconds = delay_seconds

    def run(self, db: Session) -> None:
        coins = db.query(Coin).order_by(Coin.market_cap.desc().nullslast()).all()
        if not coins:
            return
        if self.limit is not None:
            coins = coins[: self.limit]

        for i, coin in enumerate(coins):
            try:
                payload = fetch_coin_details(coin.slug, vs_currency=self.vs_currency)
            except Exception:
                # For robustness, skip coins that fail to fetch.
                continue

            coin_data: Dict[str, Any] = payload.get("coin", {})
            md_data: Dict[str, Any] = payload.get("market_data", {})

            # Update Coin metadata + links (description, website, whitepaper, explorer, twitter)
            if coin_data.get("description") is not None:
                coin.description = coin_data.get("description")
            if coin_data.get("website") is not None:
                coin.website = coin_data.get("website")
            if hasattr(coin, "whitepaper_url") and coin_data.get("whitepaper_url") is not None:
                coin.whitepaper_url = coin_data.get("whitepaper_url")
            if hasattr(coin, "explorer_url") and coin_data.get("explorer_url") is not None:
                coin.explorer_url = coin_data.get("explorer_url")
            if coin_data.get("twitter") is not None:
                coin.twitter = coin_data.get("twitter")
            if coin_data.get("discord") is not None:
                coin.discord = coin_data.get("discord")
            if coin_data.get("telegram") is not None:
                coin.telegram = coin_data.get("telegram")
            if coin_data.get("logo_url") is not None:
                coin.logo_url = coin_data.get("logo_url")
            if coin_data.get("category") is not None:
                coin.category = coin_data.get("category")
            if hasattr(coin, "market_cap_rank") and coin_data.get("market_cap_rank") is not None:
                coin.market_cap_rank = coin_data.get("market_cap_rank")

            # Insert MarketData row
            market_row = MarketData(
                coin_id=coin.id,
                price=md_data.get("price") or 0.0,
                market_cap=md_data.get("market_cap"),
                volume_24h=md_data.get("volume_24h"),
                price_change_24h=md_data.get("price_change_24h"),
                price_change_7d=md_data.get("price_change_7d"),
            )
            db.add(market_row)

            # Update Coin snapshot fields
            coin.price = coin_data.get("price", coin.price)
            coin.market_cap = coin_data.get("market_cap", coin.market_cap)
            coin.volume_24h = coin_data.get("volume_24h", coin.volume_24h)
            coin.circulating_supply = coin_data.get(
                "circulating_supply", coin.circulating_supply
            )
            coin.total_supply = coin_data.get("total_supply", coin.total_supply)

            # Throttle to avoid CoinGecko rate limits (skip delay after last coin)
            if i < len(coins) - 1 and self.delay_seconds > 0:
                time.sleep(self.delay_seconds)

        db.commit()

