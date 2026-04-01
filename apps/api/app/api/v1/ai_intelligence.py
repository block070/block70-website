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
from app.services.ai_intelligence.coin_intel import build_coin_intel
from app.services.ai_intelligence.coin_slug_resolve import resolve_coingecko_slug_for_ticker
from app.services.ai_intelligence.opportunity_pipeline import (
    build_opportunity_from_markets_snapshot,
    fetch_intelligence_bundle,
)
from app.services.ai_intelligence.query_sector_hints import sector_symbols_for_query
from app.services.ai_intelligence.query_intent import parse_query_intent
from app.services.ai_intelligence.report_builder import (
    build_formatted_report,
    portfolio_buckets,
    prediction_strings,
    recent_shift_strings,
)
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
    query_normalized: str | None,
) -> dict[str, Any]:
    return {
        "limit": limit,
        "timeframe": timeframe,
        "min_mcap": min_mcap if min_mcap is not None else "none",
        "risk": risk or "none",
        "query": query_normalized or "",
        "intel_v": 3,
    }


def _finalize_opportunities_response(
    db: Session,
    bundle: dict[str, Any],
    *,
    timeframe: str,
    news_agg: Any,
    hour_pl: dict[str, Any],
    limit: int,
    min_mcap: float | None,
    risk: str | None,
    query_normalized: str = "",
) -> dict[str, Any]:
    public = {k: v for k, v in bundle.items() if k != "_batch_context"}
    coin_intel = None
    coin_fallback = False
    qid = public.get("query_intent") or {}
    intent = str(qid.get("intent") or "DISCOVERY")
    focus_list = qid.get("focus_symbols") or []
    primary_sym = focus_list[0] if focus_list else None
    batch_ctx = bundle.get("_batch_context")

    if intent in ("SPECIFIC_ASSET", "ANALYSIS") and primary_sym and batch_ctx is not None:
        ps = str(primary_sym).upper()
        primary = next(
            (o for o in (public.get("opportunities") or []) if str(o.get("asset_symbol") or "").upper() == ps),
            None,
        )
        if primary is None:
            preserved_qi = dict(qid) if isinstance(qid, dict) else {}
            slug = resolve_coingecko_slug_for_ticker(db, ps)
            qi_parse = (
                parse_query_intent(query_normalized)
                if (query_normalized or "").strip()
                else parse_query_intent("")
            )
            hydrated = (
                build_opportunity_from_markets_snapshot(
                    slug,
                    focus_symbol_upper=ps,
                    db=db,
                    batch_ctx=batch_ctx,
                    timeframe=timeframe,
                    risk=risk,
                    news_scores=news_agg.scores,
                    news_mentions_24h=news_agg.mentions_24h,
                    hour_payload=hour_pl,
                    query_intent_result=qi_parse,
                )
                if slug
                else None
            )
            if hydrated is not None:
                coin_intel = build_coin_intel(
                    db,
                    primary=hydrated,
                    opportunities=list(public.get("opportunities") or []),
                    batch_ctx=batch_ctx,
                    capital_rotation=list(public.get("capital_rotation") or []),
                    query_intent=dict(qid) if isinstance(qid, dict) else {},
                    timeframe=timeframe,
                )
                coin_fallback = False
            else:
                bundle2 = fetch_intelligence_bundle(
                    limit=limit,
                    timeframe=timeframe,
                    min_mcap=min_mcap,
                    risk=risk,
                    news_scores=news_agg.scores,
                    news_mentions_24h=news_agg.mentions_24h,
                    hour_payload=hour_pl,
                    query_boost_symbols=frozenset(),
                    query_intent=parse_query_intent(""),
                )
                merged = {k: v for k, v in bundle2.items() if k != "_batch_context"}
                merged["query_intent"] = preserved_qi
                public = merged
                coin_fallback = True
        else:
            coin_intel = build_coin_intel(
                db,
                primary=primary,
                opportunities=list(public.get("opportunities") or []),
                batch_ctx=batch_ctx,
                capital_rotation=list(public.get("capital_rotation") or []),
                query_intent=dict(qid) if isinstance(qid, dict) else {},
                timeframe=timeframe,
            )

    public["coin_intel"] = coin_intel
    public["coin_fallback"] = coin_fallback
    coin_mode_triggered = bool(
        intent in ("SPECIFIC_ASSET", "ANALYSIS")
        and primary_sym
        and (coin_intel is not None or coin_fallback),
    )
    logger.info(
        "ai_intel_finalize query=%r detected_symbol=%r intent=%s coin_mode_triggered=%s coin_fallback=%s",
        query_normalized.strip(),
        str(primary_sym).upper() if primary_sym else None,
        intent,
        coin_mode_triggered,
        coin_fallback,
    )
    return public


@router.get("/opportunities")
def get_opportunities(
    db: Session = Depends(get_db),
    limit: int = 10,
    timeframe: Literal["24h", "7d"] = "24h",
    min_mcap: float | None = None,
    risk: Literal["low", "medium", "high"] | None = None,
    query: str | None = None,
) -> dict[str, Any]:
    if min_mcap is not None and min_mcap < 0:
        raise HTTPException(status_code=400, detail="min_mcap must be non-negative")
    qn = (query or "").strip()[:4000]
    params = _cache_key_params(limit, timeframe, min_mcap, risk, qn)
    cached = market_cache_get("ai_intel_bundle", _CACHE_TTL, **params)
    if isinstance(cached, dict) and isinstance(cached.get("opportunities"), list):
        return cached

    news_agg = get_news_intel_aggregate_cached(db, hours=48)
    hour_pl = fetch_hour_intelligence_payload_cached()
    qi = parse_query_intent(qn) if qn else parse_query_intent("")
    boost = sector_symbols_for_query(qn) if qn else frozenset()
    bundle = fetch_intelligence_bundle(
        limit=limit,
        timeframe=timeframe,
        min_mcap=min_mcap,
        risk=risk,
        news_scores=news_agg.scores,
        news_mentions_24h=news_agg.mentions_24h,
        hour_payload=hour_pl,
        query_boost_symbols=boost,
        query_intent=qi,
    )
    public = _finalize_opportunities_response(
        db,
        bundle,
        timeframe=timeframe,
        news_agg=news_agg,
        hour_pl=hour_pl,
        limit=limit,
        min_mcap=min_mcap,
        risk=risk,
        query_normalized=qn,
    )
    market_cache_set("ai_intel_bundle", _CACHE_TTL, public, **params)
    return public


def _analyze_stub(
    query: str,
    opportunities: list[dict[str, Any]],
    *,
    context: dict[str, Any] | None = None,
    bundle_meta: dict[str, Any] | None = None,
    batch_ctx: Any | None = None,
) -> dict[str, Any]:
    syms = [o.get("asset_symbol") for o in opportunities[:5] if o.get("asset_symbol")]
    top_line = ", ".join(syms) if syms else "no ranked assets"
    qlow = query.strip().lower()
    trends: list[str] = []
    ctx = context or {}
    regime = str((bundle_meta or {}).get("market_regime") or "TRANSITION")
    rot = (bundle_meta or {}).get("capital_rotation") or []
    for bullet in (ctx.get("recent_news") or [])[:3]:
        trends.append(str(bullet))
    for line in (ctx.get("crypto_hour_summary") or [])[:2]:
        trends.append(f"Crypto hour (Chicago): {line}")
    if rot:
        inf = [x.get("narrative_id") for x in rot[:2] if isinstance(x, dict)]
        if inf:
            trends.append(f"Capital rotation telemetry favors {' / '.join(inf)} sleeves vs the batch median.")
    trends.append(f"Market regime label: {regime} (composite weights already adjusted in-engine).")
    if "defi" in qlow or "dex" in qlow:
        trends.append("DeFi liquidity and yield narratives remain active.")
    if "btc" in qlow or "bitcoin" in qlow:
        trends.append("Bitcoin continues to anchor broader market direction.")
    if not trends:
        trends.append("Layer-1 rotation and liquidity depth drive short-term leaderboards.")
    risks = [
        "Rankings use market proxies only—not on-chain or order-book execution data.",
        "Past momentum does not guarantee future returns.",
        "Probability and confidence are distinct: confidence reflects input agreement; probability reflects pattern/confluence stack.",
    ]
    qid = (bundle_meta or {}).get("query_intent") or {}
    intent_l = str(qid.get("intent") or "DISCOVERY")
    om = str(qid.get("output_mode") or "")
    lens = ""
    if intent_l == "PREDICTION":
        lens = "Anticipatory lens—ranking favors early-cycle and implied velocity, not tape leaders alone. "
    elif intent_l == "RISK":
        lens = "Defensive lens—confidence-weighted, volatility-aware ordering. "
    elif intent_l == "SECTOR":
        lens = "Sector-filtered book—only names tagged to your narrative bucket, plus soft backfill if thin. "
    elif intent_l == "SPECIFIC_ASSET":
        lens = "Symbol-centric book—primary tickers and narrative peers surfaced first. "
    elif intent_l == "ANALYSIS":
        lens = "Single-name diagnostic—focus asset and peer sleeve in front. "
    summary = (
        f"Query: «{query[:200]}». {lens}Top symbols: {top_line}. "
        f"Regime {regime}; mode={om} intent={intent_l}. Exploratory only—not advice."
    )
    formatted_report = ""
    portfolio: dict[str, list[str]] = {}
    predictions: list[str] = []
    shifts: list[str] = []
    if batch_ctx is not None:
        portfolio = portfolio_buckets(opportunities)
        predictions = prediction_strings(batch_ctx, batch_ctx.market_regime)
        shifts = recent_shift_strings(opportunities)
        insights = list((bundle_meta or {}).get("model_insights") or [])
        formatted_report = build_formatted_report(
            query=query,
            rows=opportunities,
            ctx=batch_ctx,
            portfolio=portfolio,
            predictions=predictions,
            shifts=shifts,
            model_insights=insights,
        )
    return {
        "query": query,
        "top_opportunities": opportunities[:12],
        "key_trends": trends,
        "risks": risks,
        "summary": summary,
        "market_regime": regime,
        "capital_rotation": rot,
        "portfolio_positioning": portfolio,
        "predictions": predictions,
        "recent_shifts": shifts,
        "formatted_report": formatted_report,
        "model_insights": list((bundle_meta or {}).get("model_insights") or []),
        "query_intent": (bundle_meta or {}).get("query_intent"),
        "output_mode": ((bundle_meta or {}).get("query_intent") or {}).get("output_mode"),
    }


def _analyze_openai(
    query: str,
    opportunities: list[dict[str, Any]],
    *,
    context: dict[str, Any] | None = None,
    bundle_meta: dict[str, Any] | None = None,
    batch_ctx: Any | None = None,
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
    meta = bundle_meta or {}
    payload = {
        "query": query,
        "recent_news": (ctx.get("recent_news") or [])[:4],
        "crypto_on_the_hour": (ctx.get("crypto_hour_summary") or [])[:4],
        "market_regime": meta.get("market_regime"),
        "capital_rotation": (meta.get("capital_rotation") or [])[:6],
        "query_intent": meta.get("query_intent"),
        "candidates": [
            {
                "symbol": o.get("asset_symbol"),
                "score": o.get("score"),
                "confidence": o.get("confidence_score"),
                "probability": o.get("probability_of_move"),
                "cycle_stage": o.get("cycle_stage"),
                "risk_tier": o.get("risk_tier"),
            }
            for o in opportunities[:12]
        ],
    }
    prompt = (
        "You are a crypto research assistant. Given the user query, optional recent_news and "
        "crypto_on_the_hour strings from Block70 ingestion (ground truth for narratives), market_regime, "
        "capital_rotation phases, and ranked candidates, "
        "reply with a single JSON object only, keys: key_trends (array of 2-4 short strings), "
        "risks (array of 2-4 short strings), summary (one concise paragraph, not financial advice). "
        "Use only symbols present in candidates; cite regime and rotation labels when relevant."
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
        base = _analyze_stub(
            query,
            opportunities,
            context=context,
            bundle_meta=bundle_meta,
            batch_ctx=batch_ctx,
        )
        base["key_trends"] = [str(x) for x in trends][:8] or base["key_trends"]
        base["risks"] = [str(x) for x in risks][:8] or base["risks"]
        base["summary"] = summary[:2000] or base["summary"]
        return base
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
    qi = parse_query_intent(query)
    boost = sector_symbols_for_query(query)
    bundle = fetch_intelligence_bundle(
        limit=24,
        timeframe="24h",
        min_mcap=None,
        risk=None,
        news_scores=news_agg.scores,
        news_mentions_24h=news_agg.mentions_24h,
        hour_payload=hour_pl,
        query_boost_symbols=boost,
        query_intent=qi,
    )
    opportunities = list(bundle.get("opportunities") or [])
    batch_ctx = bundle.get("_batch_context")
    meta = {
        "market_regime": bundle.get("market_regime"),
        "capital_rotation": bundle.get("capital_rotation"),
        "synthetic_fallback": bundle.get("synthetic_fallback"),
        "model_insights": bundle.get("model_insights"),
        "query_intent": bundle.get("query_intent"),
    }
    context = {
        "recent_news": news_agg.bullets,
        "crypto_hour_summary": hour_summary_lines(hour_pl),
    }
    ai = _analyze_openai(
        query,
        opportunities,
        context=context,
        bundle_meta=meta,
        batch_ctx=batch_ctx,
    )
    if ai is not None:
        return ai
    return _analyze_stub(
        query,
        opportunities,
        context=context,
        bundle_meta=meta,
        batch_ctx=batch_ctx,
    )
