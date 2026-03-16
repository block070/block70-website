from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List, Tuple

from sqlalchemy.orm import Session

from app.models import Coin, MarketData, TrendingCoin, WalletProfile
from app.services.signals.narrative_signals import NarrativeSignal


class TrendingEngine:
    """
    Detect trending coins based on:
    - Volume spikes (MarketData)
    - Social mentions / narrative strength (NarrativeSignal)
    - Wallet activity (WalletProfile)
    - Price momentum (MarketData)

    Writes a small rolling set of TrendingCoin rows that other APIs and the
    frontend can consume.
    """

    def __init__(
        self,
        *,
        lookback_points: int = 2,
        max_trending: int = 50,
    ) -> None:
        self.lookback_points = int(lookback_points)
        self.max_trending = int(max_trending)

    def run(
        self,
        db: Session,
        *,
        narrative_signals: Iterable[NarrativeSignal] | None = None,
    ) -> None:
        if narrative_signals is None:
            narrative_signals = []

        # Map symbol -> coin
        coins = db.query(Coin).all()
        coin_by_symbol: Dict[str, Coin] = {
            c.symbol.upper(): c for c in coins
        }

        # 1) Volume + price momentum from latest MarketData snapshots.
        scores: Dict[int, float] = defaultdict(float)

        for coin in coins:
            md_rows = (
                db.query(MarketData)
                .filter(MarketData.coin_id == coin.id)
                .order_by(MarketData.timestamp.desc())
                .limit(self.lookback_points)
                .all()
            )
            if len(md_rows) < 2:
                continue

            latest = md_rows[0]
            prev = md_rows[-1]

            if prev.volume_24h and latest.volume_24h:
                vol_change = (latest.volume_24h - prev.volume_24h) / max(prev.volume_24h, 1.0)
                scores[coin.id] += max(0.0, vol_change)

            if prev.price and latest.price:
                price_change = (latest.price - prev.price) / max(prev.price, 1.0)
                scores[coin.id] += max(0.0, price_change * 0.5)

        # 2) Social / narrative strength from NarrativeSignal.
        for signal in narrative_signals:
            symbol = signal.value["token_symbol"].upper()
            coin = coin_by_symbol.get(symbol)
            if not coin:
                continue
            strength = float(signal.value.get("narrative_strength", 0.0))
            confidence = float(signal.confidence)
            scores[coin.id] += strength * confidence

        # 3) Wallet activity heuristic from WalletProfile (total_profit_usd).
        wallets = db.query(WalletProfile).order_by(
            WalletProfile.total_profit_usd.desc()
        ).limit(50).all()
        # We don't have per-coin mapping here yet, so lightly boost majors.
        for coin in coins:
            if wallets:
                scores[coin.id] += 0.1

        # Rank and write TrendingCoin rows.
        ranked: List[Tuple[int, float]] = sorted(
            scores.items(), key=lambda kv: kv[1], reverse=True
        )[: self.max_trending]

        # Clear old entries and insert new ones.
        db.query(TrendingCoin).delete()

        for coin_id, score in ranked:
            db.add(
                TrendingCoin(
                    coin_id=coin_id,
                    trend_score=float(score),
                    source="composite",
                )
            )

        db.commit()

