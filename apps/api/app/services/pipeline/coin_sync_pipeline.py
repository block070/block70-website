from __future__ import annotations

from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Coin, MarketData
from app.services.connectors.coingecko_connector import fetch_all_coins


class CoinSyncPipeline:
    """
    Pipeline to synchronize the Coin table from CoinGecko.

    This is intended to run periodically (e.g. every 30 minutes) to:
    1) Fetch a page of coins
    2) Insert new Coin records
    3) Update existing coins' static + snapshot fields
    """

    def __init__(self, vs_currency: str = "usd", per_page: int = 250) -> None:
        self.vs_currency = vs_currency
        self.per_page = per_page

    def run(self, db: Session, page: int = 1) -> None:
        coins = fetch_all_coins(vs_currency=self.vs_currency, per_page=self.per_page, page=page)
        if not coins:
            return

        existing = {
            row.slug: row
            for row in db.scalars(select(Coin).where(Coin.slug.in_([c["slug"] for c in coins]))).all()
        }

        for payload in coins:
            self._upsert_coin(db, existing.get(payload["slug"]), payload)

        db.commit()

    def _upsert_coin(self, db: Session, existing: Coin | None, payload: Dict[str, Any]) -> Coin:
        if existing is None:
            coin = Coin(
                name=payload["name"],
                symbol=payload["symbol"],
                slug=payload["slug"],
                description=payload.get("description"),
                logo_url=payload.get("logo_url"),
                website=payload.get("website"),
                whitepaper_url=payload.get("whitepaper_url"),
                explorer_url=payload.get("explorer_url"),
                twitter=payload.get("twitter"),
                discord=payload.get("discord"),
                chain=payload.get("chain"),
                category=payload.get("category"),
                market_cap_rank=payload.get("market_cap_rank"),
                market_cap=payload.get("market_cap"),
                price=payload.get("price"),
                volume_24h=payload.get("volume_24h"),
                circulating_supply=payload.get("circulating_supply"),
                total_supply=payload.get("total_supply"),
            )
            db.add(coin)
        else:
            coin = existing
            coin.name = payload["name"] or coin.name
            coin.symbol = payload["symbol"] or coin.symbol
            coin.logo_url = payload.get("logo_url") or coin.logo_url
            coin.category = payload.get("category") or coin.category
            if hasattr(coin, "market_cap_rank") and payload.get("market_cap_rank") is not None:
                coin.market_cap_rank = payload.get("market_cap_rank")
            coin.market_cap = payload.get("market_cap")
            coin.price = payload.get("price")
            coin.volume_24h = payload.get("volume_24h")
            coin.circulating_supply = payload.get("circulating_supply")
            coin.total_supply = payload.get("total_supply")
            if hasattr(coin, "whitepaper_url") and payload.get("whitepaper_url"):
                coin.whitepaper_url = payload.get("whitepaper_url")
            if hasattr(coin, "explorer_url") and payload.get("explorer_url"):
                coin.explorer_url = payload.get("explorer_url")

        db.flush()

        md = MarketData(
            coin_id=coin.id,
            price=payload.get("price") or 0.0,
            market_cap=payload.get("market_cap"),
            volume_24h=payload.get("volume_24h"),
            price_change_24h=payload.get("price_change_24h"),
            price_change_7d=payload.get("price_change_7d"),
        )
        db.add(md)
        return coin

