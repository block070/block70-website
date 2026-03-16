from __future__ import annotations

from datetime import datetime
from typing import List, Literal

from pydantic import BaseModel

from app.services.connectors.wallet_mock_connector import WalletActivityRaw


class WalletSignal(BaseModel):
    """
    Structured wallet-follow signal extracted from raw wallet activity.
    """

    signal_type: Literal["large_buy", "large_sell", "accumulation_spike", "whale_entry"]
    token_symbol: str
    wallet_address: str
    usd_value: float
    confidence: float
    timestamp: datetime


class WalletSignalExtractor:
    """
    Detects high-signal wallet events from raw activity.

    Signals:
    - large_buy
    - large_sell
    - accumulation_spike
    - whale_entry

    Only emits signals when usd_value exceeds the configured threshold.
    """

    def __init__(self, min_usd_threshold: float = 50_000.0) -> None:
        self.min_usd_threshold = float(min_usd_threshold)

    def extract(self, events: List[WalletActivityRaw]) -> List[WalletSignal]:
        signals: List[WalletSignal] = []

        for event in events:
            if event.usd_value < self.min_usd_threshold:
                continue

            base_confidence = 0.7

            if event.usd_value >= self.min_usd_threshold * 3:
                base_confidence = 0.9
            elif event.usd_value >= self.min_usd_threshold * 1.5:
                base_confidence = 0.8

            if event.transaction_type == "buy":
                signal_type: WalletSignal.__annotations__["signal_type"] = "large_buy"
            elif event.transaction_type == "sell":
                signal_type = "large_sell"
            elif event.transaction_type == "accumulate":
                signal_type = "accumulation_spike"
            else:
                # Fallback: treat unknown types as generic accumulation.
                signal_type = "accumulation_spike"

            # Heuristic: when a very large first-side event happens on a blue-chip /
            # narrative token, also mark it as a whale_entry candidate.
            whale_entry = False
            if signal_type in ("large_buy", "accumulation_spike") and event.usd_value >= (
                self.min_usd_threshold * 2
            ):
                whale_entry = True

            signals.append(
                WalletSignal(
                    signal_type=signal_type,
                    token_symbol=event.token_symbol,
                    wallet_address=event.wallet_address,
                    usd_value=event.usd_value,
                    confidence=base_confidence,
                    timestamp=event.timestamp,
                )
            )

            if whale_entry:
                signals.append(
                    WalletSignal(
                        signal_type="whale_entry",
                        token_symbol=event.token_symbol,
                        wallet_address=event.wallet_address,
                        usd_value=event.usd_value,
                        confidence=min(1.0, base_confidence + 0.05),
                        timestamp=event.timestamp,
                    )
                )

        return signals

