from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from sqlalchemy.orm import Session

from app.models import Coin, CoinSummary


class LlmClient(Protocol):
    def generate(self, prompt: str) -> str: ...


DEFAULT_PROMPT_TEMPLATE = """You are an expert crypto analyst.

Write a concise, operator-focused summary for the following project.

Name: {name}
Symbol: {symbol}
Category: {category}
Chain: {chain}
Website: {website}

Description:
{description}

Respond in the following JSON structure:
{{
  "summary": "...",
  "use_cases": "...",
  "risk_factors": "...",
  "market_positioning": "..."
}}"""


def generate_coin_summary(
    db: Session,
    *,
    coin: Coin,
    llm: LlmClient,
) -> CoinSummary:
    """
    Generate and persist an AI-powered summary for a coin.

    The LLM response is expected to be a small JSON object with fields:
    - summary
    - use_cases
    - risk_factors
    - market_positioning (folded into summary/use_cases for now)

    This function does not manage scheduling; callers (e.g. a cron job) should
    decide when to refresh summaries.
    """
    import json

    prompt = DEFAULT_PROMPT_TEMPLATE.format(
        name=coin.name,
        symbol=coin.symbol,
        category=coin.category or "",
        chain=coin.chain or "",
        website=coin.website or "",
        description=coin.description or "",
    )

    raw = llm.generate(prompt)

    try:
        data = json.loads(raw)
    except Exception:
        # Fall back to treating the whole response as a free-form summary.
        data = {
            "summary": raw.strip(),
            "use_cases": "",
            "risk_factors": "",
        }

    summary_text = str(data.get("summary") or "").strip()
    use_cases_text = str(data.get("use_cases") or "").strip()
    risk_text = str(data.get("risk_factors") or "").strip()

    if not summary_text:
        summary_text = f"{coin.name} ({coin.symbol}) summary not available."

    summary = CoinSummary(
        coin_id=coin.id,
        summary=summary_text,
        use_cases=use_cases_text or "Not specified.",
        risk_factors=risk_text or "Not specified.",
        generated_at=datetime.now(timezone.utc),
    )
    db.add(summary)
    db.commit()
    db.refresh(summary)
    return summary

