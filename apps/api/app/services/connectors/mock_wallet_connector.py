from datetime import datetime, timedelta, timezone
from typing import List

from app.schemas.signals import WalletRaw


class MockWalletConnector:
    """
    Mock smart wallet activity connector.

    In production this would track smart wallets on explorers like Etherscan or Solscan.
    For now, it returns realistic static events for a few high-performing wallets.
    """

    source_name = "mock_wallet_tracker"

    def fetch_raw(self) -> List[WalletRaw]:
        now = datetime.now(timezone.utc)
        return [
            WalletRaw(
                wallet_address="0xAlphaWallet11111111111111111111111111111111",
                chain="ethereum",
                token_symbol="PEPE",
                action="buy",
                amount_usd=45_000,
                realized_pnl_30d_pct=320.0,
                realized_trades_30d=38,
                win_rate_30d=0.71,
                tx_hash="0xtxhash-alpha-pepe-1",
                detected_at=now - timedelta(minutes=5),
                external_id="eth-alpha-pepe-buy-1",
            ),
            WalletRaw(
                wallet_address="So1Sm4rtW4ll3t11111111111111111111111111111",
                chain="solana",
                token_symbol="SOL",
                action="buy",
                amount_usd=120_000,
                realized_pnl_30d_pct=85.0,
                realized_trades_30d=64,
                win_rate_30d=0.63,
                tx_hash="0xtxhash-sol-smart-sol-buy-1",
                detected_at=now - timedelta(minutes=12),
                external_id="sol-smart-sol-buy-1",
            ),
            WalletRaw(
                wallet_address="0xAlphaWallet11111111111111111111111111111111",
                chain="ethereum",
                token_symbol="WIF",
                action="buy",
                amount_usd=18_000,
                realized_pnl_30d_pct=320.0,
                realized_trades_30d=38,
                win_rate_30d=0.71,
                tx_hash="0xtxhash-alpha-wif-1",
                detected_at=now - timedelta(minutes=20),
                external_id="eth-alpha-wif-buy-1",
            ),
        ]

