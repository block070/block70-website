from __future__ import annotations

from typing import Literal

from sqlalchemy.orm import Session

from app.models import AlphaSnapshot
from app.services.scoring.alpha_ranking_engine import AlphaRankingEngine
from app.services.pipeline.alert_engine import evaluate_alpha_alerts


SnapshotType = Literal["hourly", "daily"]


class AlphaSnapshotPipeline:
    """
    Pipeline that runs the Alpha Ranking Engine and stores ranking snapshots.

    Steps:
    1. Load all ACTIVE opportunities via the AlphaRankingEngine.
    2. Compute alpha rankings.
    3. Store the top N as AlphaSnapshot records.
    4. Mark rank_position (1-based) for each stored snapshot.

    This allows Block70 to reconstruct historical "top alpha" signals across
    arbitrage, miner, wallet, narrative, airdrop, developer, and other
    opportunity types.
    """

    def __init__(self) -> None:
        self._engine = AlphaRankingEngine()

    def run(
        self,
        db: Session,
        *,
        snapshot_type: SnapshotType,
        top_n: int = 5,
    ) -> list[AlphaSnapshot]:
        """
        Execute the snapshot pipeline and persist AlphaSnapshot rows.

        Returns the list of persisted AlphaSnapshot objects.
        """
        ranking_result = self._engine.rank(db, top_n=top_n)
        top_opportunities = ranking_result.top

        snapshots: list[AlphaSnapshot] = []
        ranked_pairs = []

        for idx, opp in enumerate(top_opportunities, start=1):
            alpha_score = self._engine._compute_alpha_score(opp)
            ranked_pairs.append((opp, alpha_score))

            snapshot = AlphaSnapshot(
                opportunity_id=opp.id,
                alpha_score=alpha_score,
                rank_position=idx,
                snapshot_type=snapshot_type,
            )
            db.add(snapshot)
            snapshots.append(snapshot)

        if snapshots:
            # Evaluate alpha_alerts based on the new ranking.
            evaluate_alpha_alerts(db, ranked_pairs)
            db.commit()

        return snapshots

