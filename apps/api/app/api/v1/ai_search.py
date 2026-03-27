"""
AI Search API: natural language questions → AI-generated answer + related data.
"""

from __future__ import annotations

from typing import Any, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user_optional
from app.db import get_db
from app.models import User, AISearchQuery
from app.services.ai.ai_query_processor import AIQueryProcessor
from app.services.ai.data_retrieval_engine import DataRetrievalEngine
from app.services.ai.response_generator import ResponseGenerator
from app.services.ai.query_ranking import record_query, normalize_for_ranking


router = APIRouter(prefix="/api/v1/ai-search", tags=["ai-search"])

# Simple in-memory cache: normalized_query -> (response_text, confidence, metadata). Optional.
_ai_search_cache: dict[str, tuple[str, float, dict]] = {}
_CACHE_MAX = 200

# Appended to composed query text to bias retrieval (template-based generator).
_MODE_SUFFIXES: dict[str, str] = {
    "general": "",
    "signals": " trading signals radar unusual volume",
    "investing": " long term hold fundamentals risk",
    "depin": " depin decentralized physical infrastructure networks",
    "beginner": " explain simple beginner what is",
}


class AISearchRequest(BaseModel):
    query_text: str = ""
    """Single-turn query (used when conversation is omitted)."""
    mode: str | None = None
    """general | signals | investing | depin | beginner — shapes retrieval emphasis."""
    conversation: list[dict] | None = None
    """Optional multi-turn history: items with role (user|assistant) and content."""


def _compose_query_text(body: AISearchRequest) -> str:
    if body.conversation and len(body.conversation) > 0:
        parts: list[str] = []
        for m in body.conversation[-10:]:
            if not isinstance(m, dict):
                continue
            role = (m.get("role") or "user").strip().lower()
            content = (m.get("content") or "").strip()
            if not content:
                continue
            label = "Assistant" if role == "assistant" else "User"
            parts.append(f"{label}: {content}")
        text = "\n".join(parts).strip()
    else:
        text = (body.query_text or "").strip()

    mode = (body.mode or "general").strip().lower()
    if mode in _MODE_SUFFIXES and _MODE_SUFFIXES[mode]:
        text = f"{text} {_MODE_SUFFIXES[mode]}".strip()
    return text


def _last_user_message(body: AISearchRequest) -> str:
    if body.conversation:
        for m in reversed(body.conversation):
            if not isinstance(m, dict):
                continue
            if (m.get("role") or "").strip().lower() == "user":
                return (m.get("content") or "").strip()
    return (body.query_text or "").strip()


class AISearchResponse(BaseModel):
    answer: str
    confidence_score: float
    related_tokens: List[str]
    related_signals: List[dict]
    related_opportunities: List[dict]
    related_insights: List[dict]
    related_radar: List[dict]
    query_id: int | None = None


@router.post("", response_model=dict)
def ai_search(
    body: AISearchRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> dict:
    """
    POST /api/v1/ai-search
    Input: query_text
    Return: AI-generated answer, related tokens, related signals, confidence.
    """
    composed = _compose_query_text(body)
    last_user_q = _last_user_message(body)
    if not composed:
        return {
            "answer": "Please enter a question.",
            "confidence_score": 0.0,
            "related_tokens": [],
            "related_signals": [],
            "related_opportunities": [],
            "related_insights": [],
            "related_radar": [],
            "related_narratives": [],
            "related_capital_flows": [],
            "related_wallet_activity": [],
            "query_id": None,
        }

    query_text = composed
    normalized = normalize_for_ranking(query_text)
    if normalized in _ai_search_cache:
        cached = _ai_search_cache[normalized]
        answer, confidence, meta = cached
        return {
            "answer": answer,
            "confidence_score": confidence,
            "related_tokens": meta.get("related_tokens", []),
            "related_signals": meta.get("related_signals", []),
            "related_opportunities": meta.get("related_opportunities", []),
            "related_insights": meta.get("related_insights", []),
            "related_radar": meta.get("related_radar", []),
            "related_narratives": meta.get("related_narratives", []),
            "related_capital_flows": meta.get("related_capital_flows", []),
            "related_wallet_activity": meta.get("related_wallet_activity", []),
            "query_id": None,
            "cached": True,
        }

    processor = AIQueryProcessor()
    retrieval = DataRetrievalEngine()
    generator = ResponseGenerator()

    processed = processor.process(query_text)
    data = retrieval.retrieve(db, processed)
    answer, confidence = generator.generate(processed, data)

    related_tokens = list(
        {s.get("token_symbol") for s in data.signals if s.get("token_symbol")}
        | {e.get("token_symbol") for e in data.radar_events if e.get("token_symbol")}
        | {o.get("asset_symbol") for o in data.opportunities if o.get("asset_symbol")}
    )[:20]

    response_metadata: dict[str, Any] = {
        "related_tokens": related_tokens,
        "related_signals": data.signals[:15],
        "related_opportunities": data.opportunities[:10],
        "related_insights": [{"id": i["id"], "title": i["title"], "summary": i.get("summary")} for i in data.ai_insights[:10]],
        "related_radar": data.radar_events[:10],
        "related_narratives": data.narratives[:8],
        "related_capital_flows": data.capital_flows[:8],
        "related_wallet_activity": data.wallet_activity[:6],
    }

    record_query(db, last_user_q or query_text)

    query_id = None
    if current_user:
        row = AISearchQuery(
            user_id=current_user.id,
            query_text=(last_user_q or query_text)[:2000],
            response_text=answer,
            confidence_score=confidence,
            response_metadata=response_metadata,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        query_id = row.id

    if len(_ai_search_cache) < _CACHE_MAX:
        _ai_search_cache[normalized] = (answer, confidence, response_metadata)

    return {
        "answer": answer,
        "confidence_score": round(confidence, 3),
        "related_tokens": related_tokens,
        "related_signals": data.signals[:15],
        "related_opportunities": data.opportunities[:10],
        "related_insights": response_metadata["related_insights"],
        "related_radar": data.radar_events[:10],
        "related_narratives": response_metadata["related_narratives"],
        "related_capital_flows": response_metadata["related_capital_flows"],
        "related_wallet_activity": response_metadata["related_wallet_activity"],
        "query_id": query_id,
    }


@router.get("/popular")
def get_popular_queries(
    db: Session = Depends(get_db),
    limit: int = 20,
) -> list[dict]:
    """GET /api/v1/ai-search/popular — most common queries (for suggested questions)."""
    from app.services.ai.query_ranking import most_popular_queries
    return most_popular_queries(db, limit=limit)


@router.get("/history", response_model=list[dict])
def get_search_history(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
    limit: int = 50,
) -> list[dict]:
    """GET /api/v1/ai-search/history — current user's previous AI searches."""
    if not current_user:
        return []
    rows = (
        db.query(AISearchQuery)
        .filter(AISearchQuery.user_id == current_user.id)
        .order_by(AISearchQuery.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "query_text": r.query_text,
            "response_text": (r.response_text or "")[:500],
            "confidence_score": r.confidence_score,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
