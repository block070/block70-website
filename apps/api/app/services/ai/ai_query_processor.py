"""
AI Query Processor: interpret user questions and determine which data sources to use.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List

SOURCES = frozenset({"signals", "wallet_activity", "capital_flows", "market_data", "narratives", "opportunities", "ai_insights", "radar"})


@dataclass
class ProcessedQuery:
    """Result of query processing."""
    query_text: str
    normalized: str
    sources: List[str]  # which data sources to query
    token_symbol: str | None  # if query mentions a specific token
    intent: str  # e.g. whales_buying, trending_narratives, unusual_volume, token_info, general


class AIQueryProcessor:
    """
    Interpret natural language questions and determine:
    - which data sources to use (signals, wallets, flows, market, narratives)
    - whether the query is token-specific (extract symbol)
    - high-level intent for response shaping
    """

    # Keywords that suggest data sources
    SOURCE_HINTS = {
        "signal": "signals",
        "signals": "signals",
        "whale": "wallet_activity",
        "whales": "wallet_activity",
        "wallet": "wallet_activity",
        "smart money": "wallet_activity",
        "flow": "capital_flows",
        "flows": "capital_flows",
        "capital": "capital_flows",
        "narrative": "narratives",
        "narratives": "narratives",
        "trending": "narratives",
        "opportunit": "opportunities",
        "opportunities": "opportunities",
        "radar": "radar",
        "volume": "signals",
        "price": "market_data",
        "market": "market_data",
        "insight": "ai_insights",
        "insights": "ai_insights",
    }

    # Token symbol pattern: 2–10 uppercase letters, or common tickers
    TOKEN_PATTERN = re.compile(r"\b([A-Z]{2,10})\b")

    def process(self, query_text: str) -> ProcessedQuery:
        """Parse query and return sources + optional token + intent."""
        text = (query_text or "").strip()
        lower = text.lower()
        normalized = " ".join(lower.split())

        sources: List[str] = list(SOURCES)
        token_symbol: str | None = None
        intent = "general"

        # Detect token mention: look for known ticker-like words
        candidates = self.TOKEN_PATTERN.findall(text)
        if candidates:
            token_symbol = candidates[0].upper()

        # Narrow sources by keywords
        chosen = set()
        for keyword, source in self.SOURCE_HINTS.items():
            if keyword in lower and source in SOURCES:
                chosen.add(source)
        if chosen:
            sources = list(chosen)
        else:
            sources = ["signals", "narratives", "opportunities", "wallet_activity", "capital_flows"]

        if "whale" in lower or "whales" in lower or "buying" in lower:
            intent = "whales_buying"
        elif "narrative" in lower or "trending" in lower:
            intent = "trending_narratives"
        elif "volume" in lower or "unusual" in lower:
            intent = "unusual_volume"
        elif token_symbol:
            intent = "token_info"

        return ProcessedQuery(
            query_text=text,
            normalized=normalized,
            sources=sources,
            token_symbol=token_symbol,
            intent=intent,
        )
