from __future__ import annotations

import json
import os
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models import (
    Opportunity,
    OpportunityResearchReport,
    OpportunitySignal,
)


def _get_openai_client():
    """
    Lazily construct an OpenAI client.

    Using a local import keeps this module importable even if the openai
    package is not installed, and surfaces a clear error at call time.
    """
    try:
        from openai import OpenAI  # type: ignore
    except Exception as exc:  # pragma: no cover - environment-specific
        raise RuntimeError(
            "openai package is required to use OpportunityResearchReportEngine. "
            "Install it with `pip install openai` and configure OPENAI_API_KEY."
        ) from exc

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY environment variable is not set. "
            "It is required for AI research reports."
        )

    return OpenAI()


class OpportunityResearchReportEngine:
    """
    Generate long-form, AI-driven research reports for opportunities.

    Report sections:
    - project_overview
    - signal_analysis
    - risk_factors
    - potential_upside
    - market_narrative

    Reports are stored in the OpportunityResearchReport table and can be
    re-used across the app.
    """

    def __init__(self, *, model: str | None = None) -> None:
        self._model = model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    def get_or_create_report(
        self,
        db: Session,
        opportunity: Opportunity,
    ) -> OpportunityResearchReport:
        """
        Return an existing research report for the opportunity, or generate
        and persist a new one if none exists yet.
        """
        existing = (
            db.query(OpportunityResearchReport)
            .filter(
                OpportunityResearchReport.opportunity_id == opportunity.id,
            )
            .order_by(OpportunityResearchReport.created_at.desc())
            .first()
        )
        if existing is not None:
            return existing

        payload = self._build_payload(db, opportunity)
        sections = self._call_llm(payload)

        # Build a single long-form text block that can be rendered as a
        # contiguous research note, while still storing structured sections.
        report_content = (
            "Project Overview\n\n"
            f"{sections['project_overview'].strip()}\n\n"
            "Signal Analysis\n\n"
            f"{sections['signal_analysis'].strip()}\n\n"
            "Risk Factors\n\n"
            f"{sections['risk_factors'].strip()}\n\n"
            "Potential Upside\n\n"
            f"{sections['potential_upside'].strip()}\n\n"
            "Market Narrative\n\n"
            f"{sections['market_narrative'].strip()}\n"
        )

        report = OpportunityResearchReport(
            opportunity_id=opportunity.id,
            report_content=report_content,
            project_overview=sections["project_overview"],
            signal_analysis=sections["signal_analysis"],
            risk_factors=sections["risk_factors"],
            potential_upside=sections["potential_upside"],
            market_narrative=sections["market_narrative"],
        )

        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _build_payload(
        self,
        db: Session,
        opportunity: Opportunity,
    ) -> Dict[str, Any]:
        """
        Construct a structured payload combining the opportunity's narrative,
        scoring metrics, and attached signals.
        """
        signals: List[Dict[str, Any]] = []
        rows: List[OpportunitySignal] = (
            db.query(OpportunitySignal)
            .filter(OpportunitySignal.opportunity_id == opportunity.id)
            .order_by(OpportunitySignal.created_at.asc())
            .limit(30)
            .all()
        )
        for s in rows:
            signals.append(
                {
                    "signal_type": s.signal_type,
                    "signal_value": s.signal_value,
                    "signal_weight": s.signal_weight,
                    "confidence": s.confidence,
                    "notes": s.notes,
                    "detected_at": s.detected_at.isoformat()
                    if s.detected_at is not None
                    else None,
                }
            )

        return {
            "opportunity": {
                "id": opportunity.id,
                "title": opportunity.title,
                "type": opportunity.type,
                "chain": opportunity.chain,
                "status": opportunity.status,
                "summary": opportunity.summary,
                "thesis": opportunity.thesis,
                "asset_symbol": opportunity.asset_symbol,
                "base_symbol": opportunity.base_symbol,
                "quote_symbol": opportunity.quote_symbol,
                "risk_level": opportunity.risk_level,
                "difficulty_level": opportunity.difficulty_level,
                "source": opportunity.source,
            },
            "scores": {
                "total_score": opportunity.total_score,
                "upside_score": opportunity.upside_score,
                "confidence_score": opportunity.confidence_score,
                "freshness_score": opportunity.freshness_score,
                "liquidity_score": opportunity.liquidity_score,
                "accessibility_score": opportunity.accessibility_score,
                "risk_score": opportunity.risk_score,
                "difficulty_score": opportunity.difficulty_score,
                "estimated_roi_percent": opportunity.estimated_roi_percent,
            },
            "signals": signals,
        }

    def _call_llm(self, payload: Dict[str, Any]) -> Dict[str, str]:
        """
        Call the OpenAI Chat Completions API with a deterministic, structured
        prompt and parse the JSON response into report sections.
        """
        client = _get_openai_client()

        opp = payload.get("opportunity", {}) or {}
        opp_type = str(opp.get("type") or "").lower()

        system_msg = (
            "You are a senior research analyst at a professional crypto "
            "fund. You write clear, structured internal research notes. "
            "You must return a single JSON object with fixed keys and NO "
            "markdown or extra commentary."
        )

        if opp_type == "project_discovery":
            # Tailored instructions for project_discovery opportunities, which
            # originate from CandidateProject detection. We still use the same
            # JSON keys, but map them onto the requested sections:
            #
            # - project_overview       -> project overview + technology summary
            # - signal_analysis        -> developer activity + community signals
            # - risk_factors           -> key risk factors
            # - potential_upside       -> potential upside
            # - market_narrative       -> how the project fits into current narratives
            user_msg = (
                "You are given normalized project_discovery opportunity data for an "
                "early-stage crypto project, including narrative, scores, and any "
                "supporting signals.\n\n"
                "Input JSON:\n"
                f"{json.dumps(payload, separators=(',', ':'), ensure_ascii=False)}\n\n"
                "Write a long-form research note focused on project discovery, then "
                "return it as a single JSON object with exactly these string fields:\n"
                "- project_overview: 2–3 paragraphs describing the project's purpose and "
                "technology, what it is trying to build, and how it fits into the broader "
                "ecosystem.\n"
                "- signal_analysis: detailed discussion of developer activity and community "
                "signals that led to this project being surfaced (e.g. GitHub traction, "
                "social activity, radar events) and how strong/reliable they appear.\n"
                "- risk_factors: in-depth discussion of the main risks and unknowns "
                "(execution risk, competition, token design uncertainty, narrative fatigue, etc.).\n"
                "- potential_upside: description of the upside case for this project if it "
                "executes well, including what kind of users or flows it could attract and "
                "how large the opportunity might be.\n"
                "- market_narrative: how this project fits into current market structure and "
                "narratives (e.g. L2s, DePIN, restaking, AI) and what catalysts might make it "
                "front-of-mind for sophisticated investors.\n\n"
                "Constraints:\n"
                "- The JSON must be directly parseable by a standard JSON parser.\n"
                "- Do NOT include markdown, code fences, comments, or extra keys.\n"
                "- Keep the tone institutional, analytical, and free of hype.\n"
            )
        else:
            user_msg = (
                "You are given normalized opportunity data including narrative, "
                "scores, and supporting signals.\n\n"
                "Input JSON:\n"
                f"{json.dumps(payload, separators=(',', ':'), ensure_ascii=False)}\n\n"
                "Write a long-form research note with these sections, then return "
                "them as a single JSON object with exactly these string fields:\n"
                "- project_overview: 2–4 paragraphs describing what this project/opportunity is, "
                "how it fits into the broader ecosystem, and why it exists.\n"
                "- signal_analysis: detailed explanation of the key signals driving this "
                "opportunity (wallet flows, DEX activity, miner economics, narratives, etc.) "
                "and how strong/reliable they appear.\n"
                "- risk_factors: in-depth discussion of the main risks, failure modes, and "
                "assumptions that could break the thesis.\n"
                "- potential_upside: discussion of the upside case, including how the estimated "
                "ROI and scoring components translate into real-world payoff potential.\n"
                "- market_narrative: how this opportunity fits into current market structure and "
                "narratives (e.g. L2 rotation, DePIN, AI tokens), and what catalysts might make "
                "it front-of-mind.\n\n"
                "Constraints:\n"
                "- The JSON must be directly parseable by a standard JSON parser.\n"
                "- Do NOT include markdown, code fences, comments, or extra keys.\n"
                "- Keep the tone institutional, analytical, and free of hype.\n"
            )

        completion = client.chat.completions.create(
            model=self._model,
            temperature=0.0,
            top_p=0.0,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
        )

        content = completion.choices[0].message.content or ""

        text = content.strip()
        if text.startswith("```"):
            lines = [line for line in text.splitlines() if not line.startswith("```")]
            text = "\n".join(lines).strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Failed to parse LLM research report JSON: {exc}")

        if not isinstance(data, dict):
            raise RuntimeError("LLM research report response must be a JSON object.")

        sections: Dict[str, str] = {}
        for key in [
            "project_overview",
            "signal_analysis",
            "risk_factors",
            "potential_upside",
            "market_narrative",
        ]:
            value = data.get(key, "")
            sections[key] = str(value) if value is not None else ""

        return sections

