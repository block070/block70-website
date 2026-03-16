from __future__ import annotations

import json
import os
from collections import Counter
from typing import Any, Dict, Iterable, List, Sequence

from sqlalchemy.orm import Session

from app.models import DailyBriefing, Opportunity, OpportunitySignal, RadarSignal


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
            "openai package is required to use DailyBriefingEngine. "
            "Install it with `pip install openai` and configure OPENAI_API_KEY."
        ) from exc

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY environment variable is not set. "
            "It is required for AI daily briefings."
        )

    return OpenAI()


class DailyBriefingEngine:
    """
    Generate a daily crypto intelligence briefing for Block70.

    Inputs:
    - top opportunities (already ranked by the Alpha engine or similar)
    - radar events (aggregated RadarSignal-style objects)
    - wallet signals (raw or normalized opportunity signals)
    - market data (external summary such as BTC/ETH/SOL performance)

    Output:
    - Persisted DailyBriefing record with:
      - narrative summary (summary, market_sentiment)
      - structured JSON payloads for top_opportunities, top_tokens, radar_events
    """

    def __init__(self, *, model: str | None = None) -> None:
        self._model = model or os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    def generate_daily_briefing(
        self,
        db: Session,
        *,
        top_opportunities: Sequence[Opportunity],
        radar_events: Sequence[RadarSignal],
        wallet_signals: Sequence[OpportunitySignal],
        market_data: Dict[str, Any] | None = None,
    ) -> DailyBriefing:
        """
        Generate and persist a DailyBriefing row from the provided inputs.

        Callers are responsible for selecting the appropriate inputs
        (e.g. alpha-ranked opportunities, most recent radar clusters,
        representative wallet signals, and any upstream market snapshot).
        """
        payload = self._build_payload(
            top_opportunities=top_opportunities,
            radar_events=radar_events,
            wallet_signals=wallet_signals,
            market_data=market_data or {},
        )

        llm_fields = self._call_llm(payload)

        briefing = DailyBriefing(
            summary=llm_fields.get("summary", "")[:20_000],
            top_opportunities=payload["top_opportunities"],
            top_tokens=payload["top_tokens"],
            radar_events=payload["radar_events"],
            market_sentiment=llm_fields.get("market_sentiment"),
        )

        db.add(briefing)
        db.commit()
        db.refresh(briefing)
        return briefing

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _build_payload(
        self,
        *,
        top_opportunities: Sequence[Opportunity],
        radar_events: Sequence[RadarSignal],
        wallet_signals: Sequence[OpportunitySignal],
        market_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Build a compact, structured snapshot of the day's state to feed into
        the LLM. This keeps the prompt deterministic and model-agnostic.
        """
        opp_items: List[Dict[str, Any]] = []
        token_counter: Counter[str] = Counter()

        for opp in top_opportunities:
            token = (
                opp.asset_symbol
                or opp.base_symbol
                or (opp.type or "").upper()
            )
            if token:
                token_counter[token] += 1

            opp_items.append(
                {
                    "id": opp.id,
                    "title": opp.title,
                    "type": opp.type,
                    "chain": opp.chain,
                    "token": token or None,
                    "total_score": opp.total_score,
                    "estimated_roi_percent": opp.estimated_roi_percent,
                    "risk_level": opp.risk_level,
                    "status": opp.status,
                }
            )

        radar_items: List[Dict[str, Any]] = []
        for ev in radar_events:
            radar_items.append(
                {
                    "id": ev.id,
                    "signal_type": ev.signal_type,
                    "token_symbol": ev.token_symbol,
                    "chain": ev.chain,
                    "signal_strength": ev.signal_strength,
                    "confidence_score": ev.confidence_score,
                    "source": ev.source,
                    "created_at": ev.created_at.isoformat(),
                }
            )
            if ev.token_symbol:
                token_counter[ev.token_symbol] += 1

        wallet_items: List[Dict[str, Any]] = []
        for s in wallet_signals:
            wallet_items.append(
                {
                    "signal_type": s.signal_type,
                    "signal_value": s.signal_value,
                    "confidence": s.confidence,
                    "notes": s.notes,
                    "detected_at": s.detected_at.isoformat()
                    if s.detected_at is not None
                    else None,
                }
            )

        # Derive a simple "top tokens" view from the opportunity + radar tokens.
        top_tokens: List[Dict[str, Any]] = []
        for token, count in token_counter.most_common(10):
            top_tokens.append({"token_symbol": token, "signal_count": count})

        return {
            "top_opportunities": opp_items,
            "radar_events": radar_items,
            "wallet_signals": wallet_items,
            "top_tokens": top_tokens,
            "market_data": market_data,
        }

    def _call_llm(self, payload: Dict[str, Any]) -> Dict[str, str]:
        """
        Call the OpenAI Chat Completions API with a deterministic, structured
        prompt and parse the JSON response into briefing fields.
        """
        client = _get_openai_client()

        system_msg = (
            "You are the lead macro/crypto strategist for a professional "
            "research terminal. You must turn normalized system data into a "
            "concise, institutional-grade daily intelligence brief. Output "
            "MUST be a single JSON object with fixed keys and no markdown."
        )

        user_msg = (
            "You are given the day's top opportunities, radar events, wallet "
            "signals, and a small market_data snapshot.\n\n"
            "Input JSON:\n"
            f"{json.dumps(payload, separators=(',', ':'), ensure_ascii=False)}\n\n"
            "Return a single JSON object with exactly these string fields:\n"
            "- summary: 3–6 sentences summarizing what matters today across "
            "opportunities, on-chain activity, and market tone.\n"
            "- market_sentiment: a short phrase like 'constructive risk-on', "
            "'balanced but fragile', or 'risk-off / defensive'.\n\n"
            "Constraints:\n"
            "- The JSON must be directly parseable by a standard JSON parser.\n"
            "- Do NOT include markdown, code fences, comments, or extra keys.\n"
            "- Keep the tone neutral, factual, and suitable for a PM briefing.\n"
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
            raise RuntimeError(f"Failed to parse LLM daily briefing JSON: {exc}")

        if not isinstance(data, dict):
            raise RuntimeError("LLM daily briefing response must be a JSON object.")

        out: Dict[str, str] = {}
        for key in ["summary", "market_sentiment"]:
            value = data.get(key, "")
            out[key] = str(value) if value is not None else ""

        return out

