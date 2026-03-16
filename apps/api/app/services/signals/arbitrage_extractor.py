from typing import List

from app.schemas.signals import ArbitrageRaw, ArbitrageSignal


class ArbitrageSignalExtractor:
    """
    Converts raw arbitrage connector data into typed signals.
    """

    def extract(self, source: str, raw_items: List[ArbitrageRaw]) -> List[ArbitrageSignal]:
        signals: List[ArbitrageSignal] = []
        for raw in raw_items:
            dedup_key = f"arbitrage:{raw.chain}:{raw.pair}:{raw.dex_buy}:{raw.dex_sell}"
            signals.append(
                ArbitrageSignal(
                    source=source,
                    pair=raw.pair,
                    chain=raw.chain,
                    dex_buy=raw.dex_buy,
                    dex_sell=raw.dex_sell,
                    spread_pct=raw.spread_pct,
                    volume_usd=raw.volume_usd,
                    latency_ms=raw.latency_ms,
                    detected_at=raw.detected_at,
                    external_id=raw.external_id,
                    dedup_key=dedup_key,
                )
            )
        return signals

