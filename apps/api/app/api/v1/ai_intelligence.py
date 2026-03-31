from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.ai_intelligence.hour_intel_client import (
    fetch_hour_intelligence_payload_cached,
    hour_summary_lines,
)
from app.services.ai_intelligence.news_signals import get_news_intel_aggregate_cached
from app.services.ai_intelligence.opportunity_pipeline import fetch_ranked_opportunities
from app.services.connectors.market_cache import market_cache_get, market_cache_set

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai-intelligence", tags=["ai-intelligence"])

_CACHE_TTL = 90


class AnalyzeRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)


def _cache_key_params(
    limit: int,
    timeframe: str,
    min_mcap: float | None,
    risk: str | None,
) -> dict[str, Any]:
    return {
        "limit": limit,
        "timeframe": timeframe,
        "min_mcap": min_mcap if min_mcap is not None else "none",
        "risk": risk or "none",
    }


@router.get("/opportunities")
def get_opportunities(
    db: Session = Depends(get_db),
    limit: int = 10,
    timeframe: Literal["24h", "7d"] = "24h",
    min_mcap: float | None = None,
    risk: Literal["low", "medium", "high"] | None = None,
) -> list[dict[str, Any]]:
    if min_mcap is not None and min_mcap < 0:
        raise HTTPException(status_code=400, detail="min_mcap must be non-negative")
    params = _cache_key_params(limit, timeframe, min_mcap, risk)
    cached = market_cache_get("ai_intel_opps", _CACHE_TTL, **params)
    if cached is not None:
        return cached

    news_agg = get_news_intel_aggregate_cached(db, hours=48)
    hour_pl = fetch_hour_intelligence_payload_cached()
    rows = fetch_ranked_opportunities(
        limit=limit,
        timeframe=timeframe,
        min_mcap=min_mcap,
        risk=risk,
        news_scores=news_agg.scores,
        news_mentions_24h=news_agg.mentions_24h,
        hour_payload=hour_pl,
    )
    market_cache_set("ai_intel_opps", _CACHE_TTL, rows, **params)
    return rows


def _analyze_stub(
    query: str,
    opportunities: list[dict[str, Any]],
    *,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    syms = [o.get("asset_symbol") for o in opportunities[:5] if o.get("asset_symbol")]
    top_line = ", ".join(syms) if syms else "no ranked assets"
    qlow = query.strip().lower()
    trends: list[str] = []
    ctx = context or {}
    for bullet in (ctx.get("recent_news") or [])[:3]:
        trends.append(str(bullet))
    for line in (ctx.get("crypto_hour_summary") or [])[:2]:
        trends.append(f"Crypto hour (Chicago): {line}")
    if "defi" in qlow or "dex" in qlow:
        trends.append("DeFi liquidity and yield narratives remain active.")
    if "btc" in qlow or "bitcoin" in qlow:
        trends.append("Bitcoin continues to anchor broader market direction.")
    if not trends:
        trends.append("Layer-1 rotation and liquidity depth drive short-term leaderboards.")
    risks = [
        "Rankings use market proxies only—not on-chain or order-book execution data.",
        "Past momentum does not guarantee future returns.",
    ]
    summary = (
        f"Query: «{query[:200]}». Top symbols by alpha score: {top_line}. "
        "Scores blend momentum, liquidity, and risk-adjusted calm; treat as exploratory, not advice."
    )
    return {
        "query": query,
        "top_opportunities": opportunities[:8],
        "key_trends": trends,
        "risks": risks,
        "summary": summary,
    }


def _analyze_openai(
    query: str,
    opportunities: list[dict[str, Any]],
    *,
    context: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        from openai import OpenAI
    except ImportError:
        logger.debug("openai package not installed")
        return None

    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    client = OpenAI(api_key=api_key)
    ctx = context or {}
    payload = {
        "query": query,
        "recent_news": (ctx.get("recent_news") or [])[:4],
        "crypto_on_the_hour": (ctx.get("crypto_hour_summary") or [])[:4],
        "candidates": [
            {
                "symbol": o.get("asset_symbol"),
                "score": o.get("score"),
                "risk_tier": o.get("risk_tier"),
            }
            for o in opportunities[:12]
        ],
    }
    prompt = (
        "You are a crypto research assistant. Given the user query, optional recent_news and "
        "crypto_on_the_hour strings from Block70 ingestion (ground truth for narratives), and ranked candidates, "
        "reply with a single JSON object only, keys: key_trends (array of 2-4 short strings), "
        "risks (array of 2-4 short strings), summary (one concise paragraph, not financial advice). "
        "Prefer citing themes from recent_news / crypto_on_the_hour when present."
    )
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": json.dumps(payload)},
            ],
            temperature=0.3,
            max_tokens=600,
        )
        text = (resp.choices[0].message.content or "").strip()
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            return None
        parsed = json.loads(m.group(0))
        trends = parsed.get("key_trends") or []
        risks = parsed.get("risks") or []
        summary = parsed.get("summary") or ""
        if not isinstance(trends, list):
            trends = []
        if not isinstance(risks, list):
            risks = []
        if not isinstance(summary, str):
            summary = ""
        return {
            "query": query,
            "top_opportunities": opportunities[:8],
            "key_trends": [str(x) for x in trends][:8],
            "risks": [str(x) for x in risks][:8],
            "summary": summary[:2000],
        }
    except Exception as e:
        logger.warning("ai-intelligence analyze OpenAI failed: %s", e)
        return None


@router.post("/analyze")
def post_analyze(body: AnalyzeRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query required")

    news_agg = get_news_intel_aggregate_cached(db, hours=48)
    hour_pl = fetch_hour_intelligence_payload_cached()
    opportunities = fetch_ranked_opportunities(
        limit=24,
        timeframe="24h",
        min_mcap=None,
        risk=None,
        news_scores=news_agg.scores,
        news_mentions_24h=news_agg.mentions_24h,
        hour_payload=hour_pl,
    )
    context = {
        "recent_news": news_agg.bullets,
        "crypto_hour_summary": hour_summary_lines(hour_pl),
    }
    ai = _analyze_openai(query, opportunities, context=context)
    if ai is not None:
        return ai
    return _analyze_stub(query, opportunities, context=context)
