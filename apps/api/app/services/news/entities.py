from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.news.types import SourceArticle


COIN_ALIAS_MAP: dict[str, tuple[str, ...]] = {
    "BTC": ("bitcoin",),
    "ETH": ("ethereum",),
    "SOL": ("solana",),
    "XRP": ("ripple",),
    "BNB": ("binance coin", "binance"),
    "DOGE": ("dogecoin",),
    "ADA": ("cardano",),
    "AVAX": ("avalanche",),
    "DOT": ("polkadot",),
    "LINK": ("chainlink",),
}

REGULATORS = ("sec", "cftc", "doj", "esma", "fca", "european commission")
ORGS = ("blackrock", "coinbase", "binance", "kraken", "grayscale", "fidelity")


@dataclass(slots=True)
class EntityExtractionResult:
    tickers: list[str]
    entities: list[dict]


def _contains_word(haystack: str, needle: str) -> bool:
    return re.search(rf"\b{re.escape(needle)}\b", haystack, flags=re.IGNORECASE) is not None


def extract_entities(article: SourceArticle) -> EntityExtractionResult:
    text = " ".join([article.title or "", article.summary or "", article.body_text or ""]).lower()
    tickers: set[str] = set()
    entities: list[dict] = []

    for ticker, aliases in COIN_ALIAS_MAP.items():
        if _contains_word(text, ticker):
            tickers.add(ticker)
            entities.append({"type": "coin", "value": ticker, "normalized_value": ticker})
            continue
        for alias in aliases:
            if _contains_word(text, alias):
                tickers.add(ticker)
                entities.append({"type": "project", "value": alias, "normalized_value": ticker})
                break

    for regulator in REGULATORS:
        if _contains_word(text, regulator):
            entities.append(
                {"type": "regulator", "value": regulator, "normalized_value": regulator.upper()}
            )
    for org in ORGS:
        if _contains_word(text, org):
            entities.append({"type": "organization", "value": org, "normalized_value": org.title()})

    return EntityExtractionResult(tickers=sorted(tickers), entities=entities)
