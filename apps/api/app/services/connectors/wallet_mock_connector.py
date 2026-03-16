from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

from pydantic import BaseModel

from app.services.streaming.event_stream import publish_event


class WalletActivityRaw(BaseModel):
    """
    Raw wallet activity event from a high-performing address.

    This is intentionally opinion-free and suitable for downstream signal
    extraction (e.g. conviction, follow-trade opportunities).
    """

    wallet_address: str
    token_symbol: str
    transaction_type: str  # e.g. "buy", "sell", "accumulate"
    amount: float
    usd_value: float
    timestamp: datetime


class WalletMockConnector:
    """
    Mock connector that simulates transactions from high-performing wallets.

    This connector does NOT talk to any real RPC or indexer. It returns a small
    set of deterministic events that resemble:
    - large buys
    - large sells
    - sudden accumulation
    """

    source_name = "wallet_mock"

    def fetch_events(self, db=None) -> List[WalletActivityRaw]:
        now = datetime.now(timezone.utc)

        # Wallet A: aggressive buyer and accumulator on a mid-cap token.
        wallet_a = "0xA1phaDeAdBeef000000000000000000000000A"

        # Wallet B: takes profit on prior positions.
        wallet_b = "0xB1gWhale0000000000000000000000000000B"

        events: List[WalletActivityRaw] = [
            # Large buy on a liquid L1
            WalletActivityRaw(
                wallet_address=wallet_a,
                token_symbol="SOL",
                transaction_type="buy",
                amount=8_000.0,
                usd_value=8_000.0 * 175.0,
                timestamp=now - timedelta(minutes=35),
            ),
            # Sudden accumulation of a narrative token
            WalletActivityRaw(
                wallet_address=wallet_a,
                token_symbol="JTO",
                transaction_type="accumulate",
                amount=120_000.0,
                usd_value=120_000.0 * 3.4,
                timestamp=now - timedelta(minutes=20),
            ),
            # Large sell / profit taking on a prior winner
            WalletActivityRaw(
                wallet_address=wallet_b,
                token_symbol="BONK",
                transaction_type="sell",
                amount=950_000_000.0,
                usd_value=950_000_000.0 * 0.000028,
                timestamp=now - timedelta(minutes=10),
            ),
            # Follow-on accumulation leg in the same wallet / token
            WalletActivityRaw(
                wallet_address=wallet_a,
                token_symbol="JTO",
                transaction_type="accumulate",
                amount=60_000.0,
                usd_value=60_000.0 * 3.45,
                timestamp=now - timedelta(minutes=5),
            ),
        ]

        # Optionally publish wallet_transaction StreamEvents when a DB
        # session is provided. This keeps existing call sites compatible
        # while enabling streaming-aware pipelines.
        if db is not None:
            for ev in events:
                publish_event(
                    db,
                    event_type="wallet_transaction",
                    source=self.source_name,
                    token_symbol=ev.token_symbol,
                    chain=None,
                    payload=ev.model_dump(),
                )

        return events

