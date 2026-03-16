"""
AI Copilot: daily market brief — summarize major signals, narrative shifts, capital flows.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Signal, CapitalFlow, MarketNarrative, RadarEvent
from app.services.ai.narrative_analyzer import NarrativeAnalyzer


@dataclass
class DailyBriefSection:
    """One section of the daily brief."""
    title: str
    summary: str
    items: List[str]


@dataclass
class CopilotDailyBrief:
    """Daily brief for the Copilot (no LLM required)."""
    major_signals: DailyBriefSection
    narrative_shifts: DailyBriefSection
    capital_flows: DailyBriefSection
    one_liner: str


class CopilotDailyBriefGenerator:
    """
    Generate a daily market brief for the Copilot:
    - major signals
    - narrative shifts (from MarketNarrative / NarrativeAnalyzer)
    - capital flows summary
    """

    def __init__(self) -> None:
        self._narrative_analyzer = NarrativeAnalyzer()

    def generate(self, db: Session) -> CopilotDailyBrief:
        """Produce the daily brief from current data."""
        major_signals = self._major_signals(db)
        narrative_shifts = self._narrative_shifts(db)
        capital_flows = self._capital_flows(db)
        one_liner = self._one_liner(major_signals, narrative_shifts, capital_flows)
        return CopilotDailyBrief(
            major_signals=major_signals,
            narrative_shifts=narrative_shifts,
            capital_flows=capital_flows,
            one_liner=one_liner,
        )

    def _major_signals(self, db: Session) -> DailyBriefSection:
        q = (
            db.query(Signal)
            .filter(
                Signal.token_symbol.isnot(None),
                Signal.confidence_score >= 0.5,
            )
            .order_by(Signal.created_at.desc())
            .limit(15)
            .all()
        )
        items = []
        for s in q[:10]:
            items.append(
                f"{s.token_symbol}: {s.title or s.signal_type} (conf: {s.confidence_score:.2f})"
            )
        return DailyBriefSection(
            title="Major signals",
            summary=f"{len(q)} high-confidence signals in the last period.",
            items=items,
        )

    def _narrative_shifts(self, db: Session) -> DailyBriefSection:
        momentum = self._narrative_analyzer.top_momentum(db, limit=5)
        items = [f"{n.name}: {n.direction} (score: {n.trend_score:.2f})" for n in momentum]
        return DailyBriefSection(
            title="Narrative shifts",
            summary=f"{len(momentum)} narratives with momentum.",
            items=items,
        )

    def _capital_flows(self, db: Session) -> DailyBriefSection:
        row = (
            db.query(
                func.count(CapitalFlow.id).label("cnt"),
                func.coalesce(func.sum(CapitalFlow.amount), 0).label("total"),
            )
            .first()
        )
        cnt = int(getattr(row, "cnt", 0) or 0) if row else 0
        total = float(getattr(row, "total", 0) or 0) if row else 0.0
        items = [f"Total flows: {cnt}, volume ~${total / 1e6:.1f}M"]
        return DailyBriefSection(
            title="Capital flows",
            summary=f"{cnt} flows tracked.",
            items=items,
        )

    def _one_liner(
        self,
        major_signals: DailyBriefSection,
        narrative_shifts: DailyBriefSection,
        capital_flows: DailyBriefSection,
    ) -> str:
        parts = [
            f"{len(major_signals.items)} major signals",
            f"{len(narrative_shifts.items)} narrative shifts",
            capital_flows.summary,
        ]
        return ". ".join(parts)
