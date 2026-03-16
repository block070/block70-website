from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import Opportunity, OpportunityAnalysis, OpportunitySignal


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
          "openai package is required to use OpportunityAnalysisService. "
          "Install it with `pip install openai` and configure OPENAI_API_KEY."
      ) from exc

  api_key = os.getenv("OPENAI_API_KEY")
  if not api_key:
      raise RuntimeError(
          "OPENAI_API_KEY environment variable is not set. "
          "It is required for AI opportunity analysis."
      )

  # The OpenAI client reads OPENAI_API_KEY from the environment by default,
  # so we do not need to pass it explicitly here.
  return OpenAI()


class OpportunityAnalysisService:
    """
    Service for generating structured AI explanations for opportunities.

    Responsibilities:
    - Build a deterministic, structured prompt from opportunity data,
      associated signals, and score components.
    - Call an LLM (OpenAI Chat Completions) to generate a JSON payload
      with the desired fields.
    - Cache the generated analysis in the OpportunityAnalysis table so
      that subsequent calls reuse existing explanations.
    """

    def __init__(self, *, model: Optional[str] = None) -> None:
        # Allow the model to be configured via environment variable with a
        # safe default that callers can override.
        self._model = model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def get_or_create_analysis(
        self,
        db: Session,
        opportunity: Opportunity,
    ) -> OpportunityAnalysis:
        """
        Return a cached AI analysis for the given opportunity, generating
        and persisting one if it does not yet exist.
        """
        existing = (
            db.query(OpportunityAnalysis)
            .filter(OpportunityAnalysis.opportunity_id == opportunity.id)
            .order_by(OpportunityAnalysis.created_at.desc())
            .first()
        )
        if existing is not None:
            return existing

        payload = self._build_prompt_payload(db, opportunity)
        analysis_fields = self._call_llm(payload)

        analysis = OpportunityAnalysis(
            opportunity_id=opportunity.id,
            analysis_summary=analysis_fields.get("analysis_summary", "")[:10_000],
            key_factors=analysis_fields.get("key_factors"),
            risk_assessment=analysis_fields.get("risk_assessment"),
            confidence_explanation=analysis_fields.get("confidence_explanation"),
            trade_strategy=analysis_fields.get("trade_strategy"),
        )

        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        return analysis

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _build_prompt_payload(
        self,
        db: Session,
        opportunity: Opportunity,
    ) -> Dict[str, Any]:
        """
        Construct a compact, structured payload describing the opportunity
        for use in the LLM prompt.
        """
        signals: List[Dict[str, Any]] = []

        rows: List[OpportunitySignal] = (
            db.query(OpportunitySignal)
            .filter(OpportunitySignal.opportunity_id == opportunity.id)
            .order_by(OpportunitySignal.created_at.asc())
            .limit(20)
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

        payload: Dict[str, Any] = {
            "opportunity": {
                "id": opportunity.id,
                "title": opportunity.title,
                "type": opportunity.type,
                "chain": opportunity.chain,
                "status": opportunity.status,
                "asset_symbol": opportunity.asset_symbol,
                "base_symbol": opportunity.base_symbol,
                "quote_symbol": opportunity.quote_symbol,
                "summary": opportunity.summary,
                "thesis": opportunity.thesis,
                "risk_level": opportunity.risk_level,
                "difficulty_level": opportunity.difficulty_level,
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
        return payload

    def _call_llm(self, payload: Dict[str, Any]) -> Dict[str, str]:
        """
        Call the OpenAI Chat Completions API with a deterministic, structured
        prompt and parse the JSON response.
        """
        client = _get_openai_client()

        system_msg = (
            "You are an expert crypto opportunity analyst for a professional "
            "research terminal. You must return concise, institutional-grade "
            "analysis in a STRICT JSON object with fixed keys, suitable for "
            "storing directly in a database. Do not include markdown, "
            "explanatory prose, or additional keys."
        )

        # The model sees a single JSON payload plus exact instructions about
        # the required keys. Temperature is set to 0 for determinism.
        user_msg = (
            "Analyze the following normalized crypto opportunity and produce a "
            "structured explanation.\n\n"
            "Input JSON:\n"
            f"{json.dumps(payload, separators=(',', ':'), ensure_ascii=False)}\n\n"
            "Return a single JSON object with exactly these string fields:\n"
            "- analysis_summary: 2–4 sentences summarizing why this opportunity matters.\n"
            "- key_factors: concise bullet-style text describing the 3–6 most important quantitative and qualitative drivers.\n"
            "- risk_assessment: balanced view of key risks and failure modes.\n"
            "- confidence_explanation: why this signal should or should not be trusted, grounded in the scores and signals.\n"
            "- trade_strategy: how a disciplined, professional trader might express or size into this opportunity.\n\n"
            "Do NOT wrap the JSON in backticks. Do NOT include any keys other than the five listed."
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

        # The model is instructed to return pure JSON; we still defensively
        # strip common formatting artifacts and handle parse errors.
        text = content.strip()
        if text.startswith("```"):
            # Handle accidental fenced code blocks.
            lines = [line for line in text.splitlines() if not line.startswith("```")]
            text = "\n".join(lines).strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"Failed to parse LLM analysis JSON response: {exc}"
            )

        if not isinstance(data, dict):
            raise RuntimeError("LLM analysis response must be a JSON object.")

        # Normalize to simple string fields.
        out: Dict[str, str] = {}
        for key in [
            "analysis_summary",
            "key_factors",
            "risk_assessment",
            "confidence_explanation",
            "trade_strategy",
        ]:
            value = data.get(key, "")
            out[key] = str(value) if value is not None else ""

        return out

