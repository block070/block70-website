from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy.orm import Session

from app.models import Opportunity, OpportunityAnalysis
from app.services.ai.opportunity_analysis_service import (
    OpportunityAnalysisService,
)


class OpportunityAnalysisPipeline:
    """
    Pipeline for generating AI-driven explanations for new opportunities.

    Steps:
    1. Load opportunities that do not yet have an associated OpportunityAnalysis.
    2. For each, call the AI analysis service to generate a structured explanation.
    3. Store the resulting OpportunityAnalysis row in the database.
    4. Avoid regenerating analysis when one already exists.

    By default the pipeline focuses on recently detected opportunities so that
    analysis stays close to real-time engine output without reprocessing the
    entire history on every run.
    """

    def __init__(self) -> None:
        self._service = OpportunityAnalysisService()

    def run(
        self,
        db: Session,
        *,
        lookback_hours: int = 24,
        max_items: int = 50,
    ) -> List[OpportunityAnalysis]:
        """
        Run the analysis pipeline and return the list of newly created
        OpportunityAnalysis objects.

        - lookback_hours controls how far back to search for opportunities
          that may still be missing analysis.
        - max_items caps the number of opportunities processed per run to
          keep latency and API usage predictable.
        """
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=max(1, lookback_hours))

        # Select opportunities that:
        # - have a detected_at timestamp within the lookback window, and
        # - do NOT yet have any associated OpportunityAnalysis row.
        #
        # This avoids re-generating explanations and keeps the job bounded.
        candidates = (
            db.query(Opportunity)
            .outerjoin(
                OpportunityAnalysis,
                OpportunityAnalysis.opportunity_id == Opportunity.id,
            )
            .filter(
                Opportunity.detected_at.isnot(None),
                Opportunity.detected_at >= cutoff,
                OpportunityAnalysis.id.is_(None),
            )
            .order_by(Opportunity.detected_at.asc())
            .limit(max_items)
            .all()
        )

        created: List[OpportunityAnalysis] = []
        for opp in candidates:
            analysis = self._service.get_or_create_analysis(db, opp)
            created.append(analysis)

        return created

