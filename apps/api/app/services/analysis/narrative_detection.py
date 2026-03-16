from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List, Tuple

from sqlalchemy.orm import Session

from app.models import Coin, CoinNarrative, Narrative
from app.services.signals.narrative_signals import NarrativeSignal


class NarrativeDetectionEngine:
    """
    Detect and maintain Narrative assignments for coins.

    Inputs:
    - Coin categories (from CoinGecko / internal taxonomy)
    - Coin descriptions
    - Narrative signals (social + dev + wallet + momentum)

    Output:
    - CoinNarrative rows with confidence_score, usable by Block70 UI and APIs.
    """

    def __init__(
        self,
        *,
        min_confidence: float = 0.2,
        max_narratives_per_coin: int = 3,
    ) -> None:
        self.min_confidence = float(min_confidence)
        self.max_narratives_per_coin = int(max_narratives_per_coin)

    def run(
        self,
        db: Session,
        *,
        signals: Iterable[NarrativeSignal],
    ) -> None:
        # 1) Ensure Narrative rows exist for any narratives referenced in signals.
        narrative_names = {s.value["narrative"] for s in signals}
        existing = {
            n.name: n
            for n in db.query(Narrative)
            .filter(Narrative.name.in_(list(narrative_names)))
            .all()
        }

        for name in narrative_names:
            if name not in existing:
                narrative = Narrative(name=name, description=None)
                db.add(narrative)
                db.flush()
                existing[name] = narrative

        # 2) Build per-coin narrative scores from signals.
        coin_by_symbol = {
            c.symbol.upper(): c for c in db.query(Coin).all()
        }

        scores: Dict[int, Dict[int, float]] = defaultdict(lambda: defaultdict(float))

        for signal in signals:
            token_symbol = signal.value["token_symbol"].upper()
            narrative_name = signal.value["narrative"]
            coin = coin_by_symbol.get(token_symbol)
            narrative = existing.get(narrative_name)
            if not coin or not narrative:
                continue

            strength = float(signal.value["narrative_strength"])
            confidence = float(signal.confidence)
            scores[coin.id][narrative.id] += strength * confidence

        # 3) For each coin, keep top-N narratives above min_confidence.
        for coin_id, per_narrative in scores.items():
            ranked: List[Tuple[int, float]] = sorted(
                per_narrative.items(), key=lambda kv: kv[1], reverse=True
            )
            top = [
                (nid, score)
                for nid, score in ranked[: self.max_narratives_per_coin]
                if score >= self.min_confidence
            ]

            # Remove existing mappings for this coin; then insert fresh ones.
            db.query(CoinNarrative).filter(CoinNarrative.coin_id == coin_id).delete()

            for narrative_id, score in top:
                mapping = CoinNarrative(
                    coin_id=coin_id,
                    narrative_id=narrative_id,
                    confidence_score=score,
                )
                db.add(mapping)

        db.commit()

