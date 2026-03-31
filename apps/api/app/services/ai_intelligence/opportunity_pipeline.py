from __future__ import annotations

from typing import Any, Literal

from app.services.ai_intelligence.hour_intel_client import (
    hour_sentiment_to_0_100,
)
from app.services.ai_intelligence.scoring_engine import (
    CoinMarketInputs,
    Timeframe,
    compute_alpha_score,
)
from app.services.connectors.coingecko_connector import fetch_all_coins


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _hour_narrative_match(symbol: str, slug: str, hour_payload: dict[str, Any] | None) -> bool:
    if not hour_payload:
        return False
    ent = hour_payload.get("entities")
    coins: list[Any] = []
    if isinstance(ent, dict):
        c = ent.get("coins")
        if isinstance(c, list):
            coins = c
    if symbol.upper() in {str(x).strip().upper() for x in coins if x}:
        return True
    slug_l = (slug or "").lower()
    sym_l = symbol.lower()
    for k in hour_payload.get("keywords") or []:
        if not isinstance(k, dict):
            continue
        term = str(k.get("term") or "").lower().strip()
        if not term:
            continue
        if term in slug_l or (slug_l and slug_l in term) or term == sym_l:
            return True
    return False


def _merge_sentiment(
    news_val: float | None,
    hour_payload: dict[str, Any] | None,
    narrative_match: bool,
) -> float | None:
    hour_100 = hour_sentiment_to_0_100(hour_payload.get("hourSentiment") if hour_payload else None)
    if news_val is not None:
        if narrative_match and hour_payload:
            return _clamp(0.85 * news_val + 0.15 * hour_100)
        return news_val
    if narrative_match and hour_payload:
        return _clamp(0.92 * 50.0 + 0.08 * hour_100)
    return None


def _social_with_hour(
    raw: Any,
    hour_payload: dict[str, Any] | None,
    narrative_match: bool,
) -> float | None:
    hour_100 = hour_sentiment_to_0_100(hour_payload.get("hourSentiment") if hour_payload else None)
    if not narrative_match or not hour_payload:
        try:
            return float(raw) if raw is not None else None
        except (TypeError, ValueError):
            return None
    try:
        base = float(raw) if raw is not None else None
    except (TypeError, ValueError):
        base = None
    if base is None:
        return _clamp(52.0 + (hour_100 - 50.0) * 0.35)
    return _clamp(base + 7.0 + (hour_100 - 50.0) * 0.06)

RiskTier = Literal["low", "medium", "high"]


def _risk_tier_from_volatility(vol_index: float) -> RiskTier:
    if vol_index < 33.34:
        return "low"
    if vol_index < 66.67:
        return "medium"
    return "high"


def _tier_matches(vol_index: float, risk: RiskTier | None) -> bool:
    if risk is None:
        return True
    return _risk_tier_from_volatility(vol_index) == risk


def _fetch_market_rows(max_rows: int = 750) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    page = 1
    per_page = 250
    max_pages = min(10, max(1, (max_rows + per_page - 1) // per_page))
    while len(rows) < max_rows and page <= max_pages:
        chunk = fetch_all_coins(per_page=per_page, page=page)
        if not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < per_page:
            break
        page += 1
    return rows


def fetch_ranked_opportunities(
    limit: int = 10,
    timeframe: Timeframe = "24h",
    min_mcap: float | None = None,
    risk: RiskTier | None = None,
    news_scores: dict[str, float] | None = None,
    news_mentions_24h: dict[str, int] | None = None,
    hour_payload: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 100))
    max_rows = min(1500, max(400, limit * 40))
    rows = _fetch_market_rows(max_rows=max_rows)

    out: list[dict[str, Any]] = []
    for row in rows:
        mcap = row.get("market_cap")
        if min_mcap is not None and min_mcap > 0:
            try:
                if mcap is None or float(mcap) < float(min_mcap):
                    continue
            except (TypeError, ValueError):
                continue

        slug = str(row.get("slug") or row.get("external_id") or "")
        base_inputs = CoinMarketInputs.from_coingecko_row(row)
        sym = base_inputs.symbol
        narrative = _hour_narrative_match(sym, slug, hour_payload)
        news_only = news_scores.get(sym) if news_scores else None
        merged_sent = _merge_sentiment(news_only, hour_payload, narrative)

        row_enriched = dict(row)
        if merged_sent is not None:
            row_enriched["sentiment_score"] = merged_sent
        if news_only is not None:
            row_enriched["news_sentiment"] = news_only
        soc = _social_with_hour(row.get("social_score"), hour_payload, narrative)
        if soc is not None:
            row_enriched["social_score"] = soc

        inputs = CoinMarketInputs.from_coingecko_row(row_enriched)
        scored = compute_alpha_score(inputs, timeframe=timeframe)
        if not _tier_matches(scored.volatility_index, risk):
            continue

        mentions = (news_mentions_24h or {}).get(sym, 0)

        out.append(
            {
                "asset": sym,
                "asset_symbol": sym,
                "name": row.get("name"),
                "coingecko_id": row.get("slug") or row.get("external_id"),
                "score": scored.score,
                "signals": scored.signals,
                "market_cap": mcap,
                "volume_24h": row.get("volume_24h"),
                "price_change_24h": inputs.price_change_24h,
                "price_change_7d": inputs.price_change_7d,
                "volatility_index": scored.volatility_index,
                "risk_tier": _risk_tier_from_volatility(scored.volatility_index),
                "news_mentions_24h": mentions,
                "hour_narrative_match": narrative,
            }
        )

    out.sort(key=lambda x: float(x.get("score") or 0), reverse=True)
    return out[:limit]
