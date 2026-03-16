from typing import List

from app.schemas.signals import WalletRaw, WalletSignal


class WalletSignalExtractor:
    """
    Converts raw wallet activity events into typed wallet-follow signals.
    """

    def extract(self, source: str, raw_items: List[WalletRaw]) -> List[WalletSignal]:
        signals: List[WalletSignal] = []
        for raw in raw_items:
            # Conviction: combination of trade size and track record.
            size_factor = min(max(raw.amount_usd / 100_000, 0.0), 1.0)
            pnl_factor = min(max(raw.realized_pnl_30d_pct / 300.0, 0.0), 1.0)
            win_rate_factor = raw.win_rate_30d  # already 0–1

            conviction_score = (size_factor * 0.4) + (pnl_factor * 0.3) + (win_rate_factor * 0.3)

            dedup_key = (
                f"wallet:{raw.wallet_address}:{raw.chain}:{raw.token_symbol}:{raw.action}"
            )

            signals.append(
                WalletSignal(
                    source=source,
                    wallet_address=raw.wallet_address,
                    chain=raw.chain,
                    token_symbol=raw.token_symbol,
                    action=raw.action,
                    amount_usd=raw.amount_usd,
                    realized_pnl_30d_pct=raw.realized_pnl_30d_pct,
                    realized_trades_30d=raw.realized_trades_30d,
                    win_rate_30d=raw.win_rate_30d,
                    tx_hash=raw.tx_hash,
                    detected_at=raw.detected_at,
                    external_id=raw.external_id,
                    conviction_score=conviction_score,
                    dedup_key=dedup_key,
                )
            )

        return signals

