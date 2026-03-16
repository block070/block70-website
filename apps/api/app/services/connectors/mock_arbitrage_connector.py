from datetime import datetime, timedelta, timezone
from typing import List

from app.schemas.signals import ArbitrageRaw


class MockArbitrageConnector:
    """
    Mock arbitrage connector.

    In production this would call real DEX/aggregator APIs. For now, it returns
    static but realistic-looking data so the pipeline can run end-to-end.
    """

    source_name = "mock_arbitrage"

    def fetch_raw(self) -> List[ArbitrageRaw]:
        now = datetime.now(timezone.utc)
        return [
            ArbitrageRaw(
                pair="SOL/USDC",
                chain="solana",
                dex_buy="Raydium",
                dex_sell="Orca",
                spread_pct=0.16,
                volume_usd=320_000,
                latency_ms=450,
                detected_at=now - timedelta(seconds=15),
                external_id="sol-usdc-raydium-orca",
            ),
            ArbitrageRaw(
                pair="ETH/USDC",
                chain="ethereum",
                dex_buy="UniswapV3",
                dex_sell="SushiSwap",
                spread_pct=0.07,
                volume_usd=1_100_000,
                latency_ms=800,
                detected_at=now - timedelta(seconds=40),
                external_id="eth-usdc-uni-sushi",
            ),
        ]

