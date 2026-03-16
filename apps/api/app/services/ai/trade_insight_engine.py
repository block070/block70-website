from __future__ import annotations

import json
import os
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models import Opportunity, OpportunitySignal


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
            "openai package is required to use TradeInsightEngine. "
            "Install it with `pip install openai` and configure OPENAI_API_KEY."
        ) from exc

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY environment variable is not set. "
            "It is required for AI trade insights."
        )

    return OpenAI()


class TradeInsightEngine:
    """
    Generate structured trade insights for a given Opportunity using an LLM.

    Insights focus on:
    - optimal entry price (relative to current normalized economics)
    - risk–reward estimate
    - confidence explanation
    - possible catalysts

    This engine does not persist results by itself; callers can cache or
    store outputs as needed.
    """

    def __init__(self, *, model: str | None = None) -> None:
        self._model = model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    def generate_insights(
        self,
        db: Session,
        opportunity: Opportunity,
    ) -> Dict[str, str]:
        """
        Generate trade insights from an opportunity's data, including
        signals and scoring metrics.

        Returns a dict with keys:
        - optimal_entry_price
        - risk_reward
        - confidence_explanation
        - possible_catalysts
        """
        payload = self._build_payload(db, opportunity)
        return self._call_llm(payload)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _build_payload(
        self,
        db: Session,
        opportunity: Opportunity,
    ) -> Dict[str, Any]:
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

        return {
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

    def _call_llm(self, payload: Dict[str, Any]) -> Dict[str, str]:
        """
        Call the OpenAI Chat Completions API with a deterministic, structured
        prompt and parse the JSON response into trade insights.
        """
        client = _get_openai_client()

        system_msg = (
            "You are a disciplined crypto execution strategist for a "
            "professional trading desk. You must provide concise, structured "
            "trade insights in STRICT JSON form, suitable for programmatic "
            "consumption. Do not include markdown, prose explanations of the "
            "format, or extra keys."
        )

        user_msg = (
            "You are given normalized opportunity data, including scores and signals.\n\n"
            "Input JSON:\n"
            f"{json.dumps(payload, separators=(',', ':'), ensure_ascii=False)}\n\n"
            "Based on this, return a single JSON object with exactly these string fields:\n"
            "- optimal_entry_price: guidance on where a prudent trader would look to enter, "
            "relative to current pricing and liquidity (do not invent exact numbers if unknown; "
            "describe the region or conditions instead).\n"
            "- risk_reward: a short description of the risk–reward profile, including how much "
            "adverse move a trader should be prepared to tolerate versus upside potential.\n"
            "- confidence_explanation: why this setup is or is not attractive, grounded in the "
            "scores (confidence, freshness, liquidity, risk) and the signals.\n"
            "- possible_catalysts: the most likely events or conditions that could make this "
            "trade work (or fail), expressed as 2–4 short bullet-style lines in plain text.\n\n"
            "Constraints:\n"
            "- The JSON must be directly parseable by a standard JSON parser.\n"
            "- Do NOT include markdown, code fences, comments, or additional keys.\n"
            "- Keep the tone institutional and concise. No emojis.\n"
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
            raise RuntimeError(f"Failed to parse LLM trade insight JSON: {exc}")

        if not isinstance(data, dict):
            raise RuntimeError("LLM trade insight response must be a JSON object.")

        out: Dict[str, str] = {}
        for key in [
            "optimal_entry_price",
            "risk_reward",
            "confidence_explanation",
            "possible_catalysts",
        ]:
            value = data.get(key, "")
            out[key] = str(value) if value is not None else ""

        return out

