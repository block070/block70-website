from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import CandidateProject, CandidateProjectAnalysis, ProjectTrend


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
            "openai package is required to use CandidateProjectAnalysisService. "
            "Install it with `pip install openai` and configure OPENAI_API_KEY."
        ) from exc

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY environment variable is not set. "
            "It is required for AI candidate project analysis."
        )

    return OpenAI()


class CandidateProjectAnalysisService:
    """
    Service for generating AI analyses for CandidateProject records.

    Explanations cover:
    - project purpose
    - signals detected (dev + social + any observed trend)
    - potential market impact
    - key risk factors

    Analyses are cached in the CandidateProjectAnalysis table to avoid
    repeated LLM calls for the same project.
    """

    def __init__(self, *, model: Optional[str] = None) -> None:
        self._model = model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    def get_or_create_analysis(
        self,
        db: Session,
        project: CandidateProject,
    ) -> CandidateProjectAnalysis:
        """
        Return a cached AI analysis for the given CandidateProject, generating
        and persisting one if it does not yet exist.
        """
        existing = (
            db.query(CandidateProjectAnalysis)
            .filter(CandidateProjectAnalysis.project_id == project.id)
            .order_by(CandidateProjectAnalysis.created_at.desc())
            .first()
        )
        if existing is not None:
            return existing

        payload = self._build_payload(db, project)
        fields = self._call_llm(payload)

        analysis = CandidateProjectAnalysis(
            project_id=project.id,
            project_purpose=fields.get("project_purpose", "")[:10_000],
            signals_detected=fields.get("signals_detected", "")[:10_000],
            potential_market_impact=fields.get("potential_market_impact", "")[:10_000],
            risk_factors=fields.get("risk_factors", "")[:10_000],
        )

        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        return analysis

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _build_payload(
        self,
        db: Session,
        project: CandidateProject,
    ) -> Dict[str, Any]:
        """
        Construct a compact, structured payload describing the candidate
        project and its activity / trend history for use in the LLM prompt.
        """
        trends: List[Dict[str, Any]] = []
        rows: List[ProjectTrend] = (
            db.query(ProjectTrend)
            .filter(ProjectTrend.project_id == project.id)
            .order_by(ProjectTrend.timestamp.desc())
            .limit(20)
            .all()
        )
        for t in rows:
            trends.append(
                {
                    "activity_score": t.activity_score,
                    "confidence_score": t.confidence_score,
                    "timestamp": t.timestamp.isoformat(),
                }
            )

        payload: Dict[str, Any] = {
            "project": {
                "id": project.id,
                "project_name": project.project_name,
                "token_symbol": project.token_symbol,
                "chain": project.chain,
                "source": project.source,
                "source_url": project.source_url,
                "description": project.description,
                "dev_activity_score": project.dev_activity_score,
                "social_activity_score": project.social_activity_score,
                "confidence_score": project.confidence_score,
                "detected_at": project.detected_at.isoformat()
                if project.detected_at is not None
                else None,
            },
            "trend": {
                "points": trends,
            },
        }
        return payload

    def _call_llm(self, payload: Dict[str, Any]) -> Dict[str, str]:
        """
        Call the OpenAI Chat Completions API with a deterministic, structured
        prompt and parse the JSON response into analysis fields.
        """
        client = _get_openai_client()

        system_msg = (
            "You are an expert crypto project analyst at a professional "
            "fund. You evaluate new and emerging projects using developer "
            "and social activity, and you must produce concise, structured "
            "analysis in STRICT JSON form suitable for direct storage."
        )

        user_msg = (
            "You are given a candidate crypto project detected by an automated "
            "Opportunity Hunter. The input JSON contains:\n"
            "- project: basic metadata and current dev/social/confidence scores\n"
            "- trend: recent activity/confidence points over time (if any)\n\n"
            "Input JSON:\n"
            f"{json.dumps(payload, separators=(',', ':'), ensure_ascii=False)}\n\n"
            "Based on this, return a single JSON object with exactly these "
            "string fields:\n"
            "- project_purpose: 2–3 paragraphs describing what this project "
            "is trying to build, how it fits into the ecosystem, and what "
            "problem it is solving (if discernible from the data).\n"
            "- signals_detected: concise bullet-style text (plain text, not "
            "markdown) summarizing the key signals (dev activity, social "
            "traction, radar/alert-style hints) that caused this project to "
            "be surfaced.\n"
            "- potential_market_impact: how meaningful this project could be "
            "for the broader crypto market if successful (e.g. infra, L2, "
            "DePIN, AI, restaking) and what kind of users it might attract.\n"
            "- risk_factors: balanced discussion of the main risks and "
            "unknowns (execution risk, narrative saturation, competition, "
            "token design uncertainty, etc.).\n\n"
            "Constraints:\n"
            "- The JSON must be directly parseable by a standard JSON parser.\n"
            "- Do NOT include markdown, code fences, comments, or extra keys.\n"
            "- Keep the tone institutional, neutral, and free of hype.\n"
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
            # Strip accidental fenced blocks.
            lines = [line for line in text.splitlines() if not line.startswith("```")]
            text = "\n".join(lines).strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"Failed to parse LLM candidate project analysis JSON: {exc}"
            )

        if not isinstance(data, dict):
            raise RuntimeError(
                "LLM candidate project analysis response must be a JSON object."
            )

        fields: Dict[str, str] = {}
        for key in [
            "project_purpose",
            "signals_detected",
            "potential_market_impact",
            "risk_factors",
        ]:
            value = data.get(key, "")
            fields[key] = str(value) if value is not None else ""

        return fields

