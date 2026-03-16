from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models import Opportunity, OpportunityStatus


@dataclass
class AlphaRankingResult:
    """
    Result of running the Alpha Ranking Engine.

    - best: single highest ranked active opportunity (or None if none exist)
    - top: top N ranked active opportunities (sorted descending by alpha_score)
    """

    best: Optional[Opportunity]
    top: List[Opportunity]


class AlphaRankingEngine:
    """
    Block70 Alpha Ranking Engine.

    Evaluates all ACTIVE opportunities across the system (arbitrage, miner, wallet,
    narrative, airdrop, developer, etc.) using a meta-score derived from:

    - total_score
    - confidence_score
    - freshness_score
    - liquidity_score
    - estimated_roi_percent
    - risk_score

    Default alpha_score formula:

      alpha_score =
        total_score         * 0.40 +
        confidence_score    * 0.20 +
        freshness_score     * 0.15 +
        liquidity_score     * 0.10 +
        roi_component       * 0.10 -
        risk_score          * 0.05

    where roi_component is a normalized version of estimated_roi_percent.
    """

    def __init__(self) -> None:
        ...

    def _compute_alpha_score(self, opp: Opportunity) -> float:
        total_score = float(getattr(opp, "total_score", 0.0) or 0.0)
        confidence_score = float(getattr(opp, "confidence_score", 0.0) or 0.0)
        freshness_score = float(getattr(opp, "freshness_score", 0.0) or 0.0)
        liquidity_score = float(getattr(opp, "liquidity_score", 0.0) or 0.0)
        risk_score = float(getattr(opp, "risk_score", 0.0) or 0.0)

        # Normalize ROI into [0, 1] on a soft 0–200% band.
        raw_roi = getattr(opp, "estimated_roi_percent", None)
        try:
            roi_percent = float(raw_roi) if raw_roi is not None else 0.0
        except (TypeError, ValueError):
            roi_percent = 0.0
        roi_component = max(0.0, min(roi_percent / 200.0, 1.0))

        alpha_score = (
            total_score * 0.40
            + confidence_score * 0.20
            + freshness_score * 0.15
            + liquidity_score * 0.10
            + roi_component * 0.10
            - risk_score * 0.05
        )
        return alpha_score

    def rank(
        self,
        db: Session,
        *,
        top_n: int = 5,
    ) -> AlphaRankingResult:
        """
        Compute alpha_scores for all ACTIVE opportunities and return:
        - best: highest ranked opportunity
        - top: top N opportunities

        All opportunity types are considered (arbitrage, mining, wallet,
        narrative, airdrop, developer, etc.), as long as status == ACTIVE.
        """
        query = db.query(Opportunity).filter(
            Opportunity.status == OpportunityStatus.ACTIVE.value,
        )

        opportunities: List[Opportunity] = list(query.all())
        if not opportunities:
            return AlphaRankingResult(best=None, top=[])

        scored: List[Tuple[float, Opportunity]] = []
        for opp in opportunities:
            score = self._compute_alpha_score(opp)
            scored.append((score, opp))

        scored.sort(key=lambda pair: pair[0], reverse=True)

        best = scored[0][1] if scored else None
        top = [opp for _, opp in scored[: max(top_n, 0)]]

        return AlphaRankingResult(best=best, top=top)

