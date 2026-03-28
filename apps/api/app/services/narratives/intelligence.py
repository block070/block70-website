"""
Aggregate narrative intelligence by joining MarketNarrative rows with narrative-type opportunities.

Matching rule: the narrative name (case-insensitive, normalized whitespace) must appear as a
substring of the opportunity title or summary.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy.orm import Session

from app.models import MarketNarrative, Opportunity, OpportunityStatus

EPS = 1e-6


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_ws(s: str) -> str:
    return " ".join(s.split()).strip()


def _aware_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _opp_effective_at(opp: Opportunity) -> Optional[datetime]:
    if opp.detected_at is not None:
        return _aware_utc(opp.detected_at)
    return _aware_utc(opp.created_at)


def _opp_matches_narrative_name(opp: Opportunity, name_norm_lower: str) -> bool:
    if not name_norm_lower:
        return False
    title = (opp.title or "").lower()
    summary = (opp.summary or "").lower()
    return name_norm_lower in title or name_norm_lower in summary


def _sum_attention_in_range(
    matched: Sequence[Opportunity],
    start: datetime,
    end: datetime,
) -> float:
    total = 0.0
    for o in matched:
        eff = _opp_effective_at(o)
        if eff is None:
            continue
        if start <= eff <= end:
            total += float(o.total_score or 0.0)
    return total


def _daily_series_for_narrative(
    matched: Sequence[Opportunity],
    days: List[date],
) -> List[Tuple[date, float]]:
    day_set = frozenset(days)
    by_day: Dict[date, float] = {d: 0.0 for d in days}
    for o in matched:
        eff = _opp_effective_at(o)
        if eff is None:
            continue
        d = eff.date()
        if d in day_set:
            by_day[d] = by_day.get(d, 0.0) + float(o.total_score or 0.0)
    return [(d, by_day[d]) for d in days]


def _sentiment_proxy(matched: Sequence[Opportunity]) -> float:
    if not matched:
        return 0.0
    vals = []
    for o in matched:
        v = float(o.upside_score or 0.0) - float(o.risk_score or 0.0)
        vals.append(v)
    m = sum(vals) / len(vals)
    return max(-1.0, min(1.0, m))


def _related_symbols(matched: Sequence[Opportunity], cap: int = 8) -> List[str]:
    best: Dict[str, float] = {}
    for o in matched:
        sym = o.asset_symbol
        if not sym:
            continue
        sc = float(o.total_score or 0.0)
        if sym not in best or sc > best[sym]:
            best[sym] = sc
    ordered = sorted(best.keys(), key=lambda k: (-best[k], k))
    return ordered[:cap]


@dataclass
class BuiltIntelligenceRow:
    narrative: MarketNarrative
    matched: List[Opportunity]
    attention_recent: float
    attention_prev: float
    growth_rate: float
    sentiment: float
    related_symbols: List[str]
    daily_series: List[Tuple[date, float]]


def _build_row(
    narrative: MarketNarrative,
    opps: Sequence[Opportunity],
    now: datetime,
    days: List[date],
) -> BuiltIntelligenceRow:
    name_key = _normalize_ws(narrative.name).lower()
    matched = [o for o in opps if _opp_matches_narrative_name(o, name_key)]

    end = now
    win_recent_start = now - timedelta(days=7)
    win_prev_start = now - timedelta(days=14)
    win_prev_end = now - timedelta(days=7)

    attention_recent = _sum_attention_in_range(matched, win_recent_start, end)
    attention_prev = _sum_attention_in_range(matched, win_prev_start, win_prev_end)
    # Week-over-week: (recent − prior) / prior. If the prior 7d window had no attention
    # (common for newly detected opps / seeds), using max(prior, EPS) explodes the ratio;
    # the web UI caps at +999%. Report 0 when there is no meaningful prior baseline.
    if attention_prev <= EPS:
        growth_rate = 0.0
    else:
        growth_rate = (attention_recent - attention_prev) / attention_prev

    sentiment = _sentiment_proxy(matched)
    related = _related_symbols(matched)
    daily_series = _daily_series_for_narrative(matched, days)

    return BuiltIntelligenceRow(
        narrative=narrative,
        matched=list(matched),
        attention_recent=attention_recent,
        attention_prev=attention_prev,
        growth_rate=growth_rate,
        sentiment=sentiment,
        related_symbols=related,
        daily_series=daily_series,
    )


def load_narrative_opportunities(db: Session) -> List[Opportunity]:
    q = db.query(Opportunity).filter(
        Opportunity.type == "narrative",
        Opportunity.status == OpportunityStatus.ACTIVE.value,
    )
    return list(q.all())


def _synthetic_market_narratives_from_opportunities(
    opps: List[Opportunity],
    *,
    cap: int,
) -> List[MarketNarrative]:
    """
    When `market_narratives` has no rows (common on fresh / under-seeded prod), derive one
    narrative per distinct opportunity title so the intelligence dashboard still surfaces live
    narrative-type opportunities.
    """
    groups: Dict[str, List[Opportunity]] = defaultdict(list)
    for o in opps:
        title = _normalize_ws(o.title or "")
        if not title:
            continue
        groups[title.lower()].append(o)

    scored: List[Tuple[float, str, List[Opportunity]]] = []
    for key, group in groups.items():
        mx = max(float(x.total_score or 0.0) for x in group)
        scored.append((mx, key, group))
    scored.sort(key=lambda x: -x[0])

    out: List[MarketNarrative] = []
    sid = -1
    for mx, _key, group in scored[:cap]:
        canonical = _normalize_ws(group[0].title or "")
        if not canonical:
            continue
        best = max(group, key=lambda x: float(x.total_score or 0.0))
        desc = _normalize_ws(best.summary or "") or None
        created_candidates = [x.created_at for x in group if x.created_at is not None]
        created_at = min(created_candidates) if created_candidates else _utc_now()
        out.append(
            MarketNarrative(
                id=sid,
                name=canonical,
                description=desc,
                trend_score=float(mx),
                created_at=created_at,
            )
        )
        sid -= 1

    return out


def narrative_from_opportunity_title_match(
    db: Session,
    decoded_name: str,
) -> Optional[MarketNarrative]:
    """Resolve drill-down when slug equals a narrative opportunity title (no DB narrative row)."""
    key = _normalize_ws(decoded_name).lower()
    if not key:
        return None
    opps = load_narrative_opportunities(db)
    group = [o for o in opps if _normalize_ws(o.title or "").lower() == key]
    if not group:
        return None
    canonical = _normalize_ws(group[0].title or "")
    best = max(group, key=lambda x: float(x.total_score or 0.0))
    desc = _normalize_ws(best.summary or "") or None
    created_candidates = [x.created_at for x in group if x.created_at is not None]
    created_at = min(created_candidates) if created_candidates else _utc_now()
    oid = min(o.id for o in group)
    return MarketNarrative(
        id=-oid,
        name=canonical,
        description=desc,
        trend_score=float(best.total_score or 0.0),
        created_at=created_at,
    )


def compute_intelligence_rows(
    db: Session,
    *,
    narrative_limit: int = 50,
) -> Tuple[List[BuiltIntelligenceRow], datetime]:
    from app.services.narratives.narrative_engine import NarrativeEngine

    engine = NarrativeEngine()
    narratives = engine.list_narratives(db, limit=narrative_limit)
    opps = load_narrative_opportunities(db)
    if not narratives and opps:
        narratives = _synthetic_market_narratives_from_opportunities(
            opps,
            cap=narrative_limit,
        )
    now = _utc_now()
    # Last 14 UTC calendar days inclusive ending today.
    today = now.date()
    days = [today - timedelta(days=13 - i) for i in range(14)]

    rows = [_build_row(n, opps, now, days) for n in narratives]
    return rows, now


def compute_intelligence_for_narrative(
    db: Session,
    narrative: MarketNarrative,
) -> BuiltIntelligenceRow:
    opps = load_narrative_opportunities(db)
    now = _utc_now()
    today = now.date()
    days = [today - timedelta(days=13 - i) for i in range(14)]
    return _build_row(narrative, opps, now, days)


def narrative_by_slug_or_id(
    db: Session,
    *,
    slug: Optional[str] = None,
    narrative_id: Optional[int] = None,
) -> Optional[MarketNarrative]:
    if narrative_id is not None:
        return db.query(MarketNarrative).filter(MarketNarrative.id == narrative_id).first()

    if slug is None or not str(slug).strip():
        return None

    from urllib.parse import unquote

    decoded = _normalize_ws(unquote(str(slug)))
    if not decoded:
        return None

    # ILIKE without wildcards = case-insensitive equality in PostgreSQL.
    row = (
        db.query(MarketNarrative)
        .filter(MarketNarrative.name.ilike(decoded))
        .first()
    )
    if row is not None:
        return row
    return narrative_from_opportunity_title_match(db, decoded)
