from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel

from app.services.streaming.event_stream import publish_event


class ArbitrageQuote(BaseModel):
    """
    Structured quote data for a DEX trading pair.
    """

    dex: str
    pair: str
    price: float
    liquidity: float
    timestamp: datetime
    route: Optional[str] = None


class ArbitrageMockConnector:
    """
    Mock connector that simulates DEX quote data for arbitrage detection.

    This connector does NOT call any real APIs. It returns deterministic,
    hard-coded quotes for a few pairs so that:
    - data is stable across runs
    - small but real spreads occasionally exist between DEXs.
    """

    pairs = ("SOL/USDC", "BONK/USDC", "JUP/USDC")
    dexes = ("Jupiter", "Raydium", "Orca")

    def fetch_quotes(self, db=None) -> List[ArbitrageQuote]:
        """
        Return mock quotes for the configured pairs across Jupiter, Raydium, and Orca.
        """
        now = datetime.now(timezone.utc)

        # Base mid prices in USDC for each pair
        base_prices = {
            "SOL/USDC": 175.0,
            "BONK/USDC": 0.000028,
            "JUP/USDC": 1.15,
        }

        # Deterministic per-DEX price adjustments (in percent) to create spreads.
        # Positive means slightly more expensive, negative means slightly cheaper.
        dex_adjustments = {
            "Jupiter": 0.0,
            "Raydium": -0.003,  # ~ -0.3%
            "Orca": 0.004,      # ~ +0.4%
        }

        # Deterministic liquidity per DEX and pair (in USDC notional).
        base_liquidity = {
            "SOL/USDC": {
                "Jupiter": 1_000_000.0,
                "Raydium": 750_000.0,
                "Orca": 650_000.0,
            },
            "BONK/USDC": {
                "Jupiter": 350_000.0,
                "Raydium": 220_000.0,
                "Orca": 180_000.0,
            },
            "JUP/USDC": {
                "Jupiter": 800_000.0,
                "Raydium": 600_000.0,
                "Orca": 500_000.0,
            },
        }

        quotes: List[ArbitrageQuote] = []

        for pair in self.pairs:
            mid = base_prices[pair]
            for dex in self.dexes:
                adj = dex_adjustments[dex]
                price = mid * (1.0 + adj)
                liquidity = base_liquidity[pair][dex]
                quote = ArbitrageQuote(
                    dex=dex,
                    pair=pair,
                    price=price,
                    liquidity=liquidity,
                    timestamp=now,
                )
                quotes.append(quote)

                # Optionally emit a dex_trade StreamEvent when a DB session
                # is provided, so event-driven consumers can react without
                # coupling directly to this connector.
                if db is not None:
                    base, quote_ccy = pair.split("/")
                    publish_event(
                        db,
                        event_type="dex_trade",
                        source="arbitrage_mock_connector",
                        token_symbol=base,
                        chain="solana",
                        payload=quote.model_dump(),
                    )

        return quotes

