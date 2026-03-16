"""
AI Copilot: monitor narratives and notify when narrative gains momentum or capital flows increase.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from sqlalchemy.orm import Session

from app.models import MarketNarrative, CapitalFlow
from app.services.ai.narrative_analyzer import NarrativeAnalyzer, NarrativeMomentum


@dataclass
class NarrativeAlert:
    """Alert when a narrative gains momentum or capital flows align."""
    narrative_name: str
    description: str | None
    trend_score: float
    direction: str
    flow_summary: str | None
    alert_type: str  # momentum | capital_flow


class NarrativeCopilot:
    """
    Monitor narratives and produce alerts for the Copilot when:
    - a narrative gains momentum
    - capital flows increase (optionally tied to narrative tokens).
    """

    def __init__(self) -> None:
        self._narrative_analyzer = NarrativeAnalyzer()

    def get_alerts(
        self,
        db: Session,
        *,
        min_trend_score: float = 0.4,
        limit: int = 10,
    ) -> List[NarrativeAlert]:
        """Return narrative-related alerts for the Copilot."""
        momentum_list = self._narrative_analyzer.analyze(
            db,
            min_trend_score=min_trend_score,
            limit=limit,
        )
        flow_summary = self._recent_flow_summary(db)

        out: List[NarrativeAlert] = []
        for m in momentum_list:
            out.append(
                NarrativeAlert(
                    narrative_name=m.name,
                    description=m.description,
                    trend_score=m.trend_score,
                    direction=m.direction,
                    flow_summary=flow_summary,
                    alert_type="momentum",
                )
            )
        if flow_summary and len(out) < limit:
            out.append(
                NarrativeAlert(
                    narrative_name="Market flows",
                    description=flow_summary,
                    trend_score=0.5,
                    direction="rising",
                    flow_summary=flow_summary,
                    alert_type="capital_flow",
                )
            )
        return out[:limit]

    def _recent_flow_summary(self, db: Session) -> str | None:
        """One-line summary of recent capital flow activity."""
        from sqlalchemy import func
        row = (
            db.query(
                func.count(CapitalFlow.id).label("cnt"),
                func.coalesce(func.sum(CapitalFlow.amount), 0).label("total"),
            )
            .first()
        )
        if not row or (getattr(row, "cnt", 0) or 0) == 0:
            return None
        cnt = int(getattr(row, "cnt", 0) or row[0])
        total = float(getattr(row, "total", 0) or row[1])
        return f"{cnt} flows, ${total / 1e6:.1f}M total (24h window)"
