"""
Backfill project descriptions for all coins from CoinGecko.

Fetches slugs from /coins/markets (paginated), then for each coin without
a description, fetches full detail from /coins/{id} and upserts to DB.
Runs with throttling to respect CoinGecko rate limits (~10-30 req/min free).
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.models import Coin
from app.services.connectors.coingecko_connector import (
    fetch_all_coins,
    fetch_coin_details,
)

logger = logging.getLogger(__name__)

FETCH_DELAY_SECONDS = float(
    __import__("os").getenv("COINGECKO_DESCRIPTION_DELAY", "2.5")
)
TOTAL_COINS = 10000
PER_PAGE = 250
PAGES_NEEDED = (TOTAL_COINS + PER_PAGE - 1) // PER_PAGE


class DescriptionBackfillPipeline:
    """
    Fetches project-specific descriptions from CoinGecko for all coins.
    """

    def __init__(
        self,
        limit: int | None = None,
        delay_seconds: float = FETCH_DELAY_SECONDS,
    ) -> None:
        self.limit = limit  # None = all 10000; set for testing
        self.delay_seconds = delay_seconds

    def run(self, db: Session) -> dict:
        """Fetch descriptions for coins that lack them. Returns stats."""
        slugs_to_fetch: list[str] = []
        for page in range(1, PAGES_NEEDED + 1):
            try:
                coins = fetch_all_coins(
                    vs_currency="usd", per_page=PER_PAGE, page=page
                )
                for c in coins:
                    slugs_to_fetch.append(c.get("slug") or "")
                if self.limit and len(slugs_to_fetch) >= self.limit:
                    slugs_to_fetch = slugs_to_fetch[: self.limit]
                    break
            except Exception as e:
                logger.warning("Failed to fetch coins page %d: %s", page, e)
                break

        slugs_to_fetch = [s for s in slugs_to_fetch if s]
        existing = {
            row.slug: row
            for row in db.query(Coin)
            .filter(Coin.slug.in_(slugs_to_fetch))
            .all()
        }

        need_description = [
            s for s in slugs_to_fetch
            if s not in existing or not (existing[s].description or "").strip()
        ]
        need_category = [
            s for s in slugs_to_fetch
            if s in existing and not (existing[s].category or "").strip()
        ]
        to_fetch = list(dict.fromkeys(need_description + need_category))

        fetched = 0
        errors = 0
        for i, slug in enumerate(to_fetch):
            if self.limit and fetched >= self.limit:
                break
            try:
                payload = fetch_coin_details(slug, vs_currency="usd")
                c = payload.get("coin") or {}
                desc = (c.get("description") or "").strip()
                cat = (c.get("category") or "").strip()
                if not desc and not cat:
                    continue
                coin = existing.get(slug)
                if coin:
                    if desc:
                        coin.description = desc
                    if cat:
                        coin.category = cat
                    coin.website = c.get("website") or coin.website
                    coin.whitepaper_url = (
                        c.get("whitepaper_url") or coin.whitepaper_url
                    )
                    coin.explorer_url = c.get("explorer_url") or coin.explorer_url
                    coin.twitter = c.get("twitter") or coin.twitter
                    coin.discord = c.get("discord") or coin.discord
                    coin.telegram = c.get("telegram") or coin.telegram
                else:
                    coin = Coin(
                        name=c.get("name") or slug,
                        symbol=(c.get("symbol") or "?").upper(),
                        slug=slug,
                        description=desc,
                        logo_url=c.get("logo_url"),
                        website=c.get("website"),
                        whitepaper_url=c.get("whitepaper_url"),
                        explorer_url=c.get("explorer_url"),
                        twitter=c.get("twitter"),
                        discord=c.get("discord"),
                        telegram=c.get("telegram"),
                        category=c.get("category"),
                        market_cap_rank=c.get("market_cap_rank"),
                        market_cap=c.get("market_cap"),
                        price=c.get("price"),
                        volume_24h=c.get("volume_24h"),
                        circulating_supply=c.get("circulating_supply"),
                        total_supply=c.get("total_supply"),
                    )
                    db.add(coin)
                    existing[slug] = coin
                fetched += 1
            except Exception as e:
                errors += 1
                logger.debug("Failed to fetch %s: %s", slug, e)
            if i < len(to_fetch) - 1 and self.delay_seconds > 0:
                time.sleep(self.delay_seconds)

        db.commit()
        return {
            "slugs_checked": len(slugs_to_fetch),
            "needed_description": len(need_description),
            "needed_category": len(need_category),
            "fetched": fetched,
            "errors": errors,
        }
