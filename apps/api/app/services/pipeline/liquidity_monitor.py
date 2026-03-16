"""
Liquidity monitoring pipeline.

Tracks liquidity and volume changes in DEX pools (Raydium, Orca). Emits
RadarSignals when liquidity spikes, liquidity drops, or volume surges so
the radar pipeline can aggregate them.
"""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import LiquidityPool, RadarSignal
from app.services.connectors.dex_pool_connector import DexPoolConnector, DexPoolRecord


class LiquidityMonitor:
    """
    Track pool liquidity and volume over time; generate signals when
    liquidity spikes, liquidity drops, or volume surges.
    """

    def __init__(
        self,
        liquidity_spike_threshold_percent: float = 20.0,
        liquidity_drop_threshold_percent: float = -20.0,
        volume_surge_threshold_percent: float = 50.0,
    ) -> None:
        self.liquidity_spike_pct = liquidity_spike_threshold_percent
        self.liquidity_drop_pct = liquidity_drop_threshold_percent
        self.volume_surge_pct = volume_surge_threshold_percent
        self._connector = DexPoolConnector()

    def run(self, db: Session) -> List[RadarSignal]:
        """
        Fetch current pool data, compare to last known state, emit RadarSignals
        for liquidity_increase, liquidity_drop, volume_spike; then upsert pools.
        """
        current = self._connector.fetch_pools()
        emitted: List[RadarSignal] = []

        for rec in current:
            prev = (
                db.query(LiquidityPool)
                .filter(
                    LiquidityPool.dex == rec.dex,
                    LiquidityPool.pair == rec.pair,
                )
                .first()
            )

            token_symbol = rec.token_a if rec.token_a != "USDC" else rec.token_b

            if prev is None:
                self._upsert_pool(db, rec)
                continue

            liq_prev = prev.liquidity_usd or 0.0
            vol_prev = prev.volume_24h or 0.0

            if liq_prev > 0:
                liq_change_pct = (rec.liquidity - liq_prev) / liq_prev * 100.0
                if liq_change_pct >= self.liquidity_spike_pct:
                    sig = RadarSignal(
                        signal_type="liquidity_increase",
                        token_symbol=token_symbol,
                        chain="solana",
                        signal_strength=min(1.0, liq_change_pct / 100.0),
                        confidence_score=0.8,
                        source="LiquidityMonitor",
                        metadata_json={
                            "dex": rec.dex,
                            "pair": rec.pair,
                            "liquidity_usd": rec.liquidity,
                            "change_percent": round(liq_change_pct, 2),
                        },
                    )
                    db.add(sig)
                    emitted.append(sig)
                elif liq_change_pct <= self.liquidity_drop_pct:
                    sig = RadarSignal(
                        signal_type="liquidity_drop",
                        token_symbol=token_symbol,
                        chain="solana",
                        signal_strength=min(1.0, abs(liq_change_pct) / 100.0),
                        confidence_score=0.8,
                        source="LiquidityMonitor",
                        metadata_json={
                            "dex": rec.dex,
                            "pair": rec.pair,
                            "liquidity_usd": rec.liquidity,
                            "change_percent": round(liq_change_pct, 2),
                        },
                    )
                    db.add(sig)
                    emitted.append(sig)

            if vol_prev > 0:
                vol_change_pct = (rec.volume - vol_prev) / vol_prev * 100.0
                if vol_change_pct >= self.volume_surge_pct:
                    sig = RadarSignal(
                        signal_type="volume_spike",
                        token_symbol=token_symbol,
                        chain="solana",
                        signal_strength=min(1.0, vol_change_pct / 150.0),
                        confidence_score=0.75,
                        source="LiquidityMonitor",
                        metadata_json={
                            "dex": rec.dex,
                            "pair": rec.pair,
                            "volume_24h": rec.volume,
                            "change_percent": round(vol_change_pct, 2),
                        },
                    )
                    db.add(sig)
                    emitted.append(sig)

            self._upsert_pool(db, rec, existing=prev)

        db.commit()
        return emitted

    def _upsert_pool(
        self,
        db: Session,
        rec: DexPoolRecord,
        existing: Optional[LiquidityPool] = None,
    ) -> None:
        if existing is not None:
            existing.liquidity_usd = rec.liquidity
            existing.volume_24h = rec.volume
            existing.fee_percent = rec.fees
            existing.token_a = rec.token_a
            existing.token_b = rec.token_b
        else:
            pool = LiquidityPool(
                dex=rec.dex,
                pair=rec.pair,
                token_a=rec.token_a,
                token_b=rec.token_b,
                liquidity_usd=rec.liquidity,
                volume_24h=rec.volume,
                fee_percent=rec.fees,
            )
            db.add(pool)
