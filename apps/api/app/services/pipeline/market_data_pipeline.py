from __future__ import annotations

from typing import Any, Dict

from sqlalchemy.orm import Session

from app.models import Coin, MarketData
from app.services.connectors.coingecko_connector import fetch_coin_details


class MarketDataPipeline:
    """
    Pipeline to refresh market data for all known coins.

    - For each Coin, fetch detail from CoinGecko
    - Insert a MarketData row
    - Update the Coin snapshot fields (price, market_cap, volume_24h, supplies)
    """

    def __init__(self, vs_currency: str = "usd") -> None:
        self.vs_currency = vs_currency

    def run(self, db: Session) -> None:
        coins = db.query(Coin).all()
        if not coins:
            return

        for coin in coins:
            try:
                payload = fetch_coin_details(coin.slug, vs_currency=self.vs_currency)
            except Exception:
                # For robustness, skip coins that fail to fetch.
                continue

            coin_data: Dict[str, Any] = payload.get("coin", {})
            md_data: Dict[str, Any] = payload.get("market_data", {})

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

        db.commit()

