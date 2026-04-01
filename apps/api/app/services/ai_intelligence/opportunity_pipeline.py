from __future__ import annotations

import logging
import statistics
from typing import Any, Literal

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.services.ai_intelligence.adaptive_model import (
    build_prediction_record,
    calibrate_probability_display,
    enqueue_prediction_records,
    load_adaptive_weights,
    model_insights_bullets,
    signal_reliability_multiplier,
)
from app.services.ai_intelligence.alpha_batch import BatchContext
from app.services.ai_intelligence.alpha_factors import (
    classify_cycle_stage,
    compute_breakout_score,
    compute_velocity_score,
    confluence_flags,
    entry_zone_signal,
    estimate_freshness,
    estimate_time_horizon,
    infer_whale_score,
    low_conviction_trap,
    momentum_volume_scores,
)
from app.services.ai_intelligence.hour_intel_client import hour_sentiment_to_0_100
from app.services.ai_intelligence.pattern_snapshots import push_rank_snapshot, rank_delta_for_symbol
from app.services.ai_intelligence.narrative_map import narratives_for_asset
from app.services.ai_intelligence.report_builder import (
    portfolio_buckets,
    prediction_strings,
    recent_shift_strings,
    synthetic_emerging_signal_lines,
)
from app.services.ai_intelligence.query_intent import (
    QueryIntentResult,
    apply_intent_post_scores,
    apply_intent_weight_multipliers,
    candidate_matches_intent,
    parse_query_intent,
    sort_key_for_mode,
)
from app.services.ai_intelligence.db_coin_snapshot import (
    minimal_row_for_major_slug,
    normalized_market_row_from_db,
)
from app.services.ai_intelligence.scoring_engine import (
    CoinMarketInputs,
    Timeframe,
    compute_alpha_score,
    compute_weighted_composite,
)
from app.services.connectors.coingecko_connector import (
    fetch_all_coins,
    fetch_coin_markets_row_by_id,
    normalize_market_coin,
)

RiskTier = Literal["low", "medium", "high"]

_SYNTHETIC_MARKET: list[dict[str, Any]] = [
    {"slug": "bitcoin", "symbol": "BTC", "name": "Bitcoin", "market_cap": 1.2e12, "volume_24h": 2.8e10, "price_change_1h": 0.12, "price_change_24h": 1.4, "price_change_7d": 4.2, "price": 98000},
    {"slug": "ethereum", "symbol": "ETH", "name": "Ethereum", "market_cap": 3.5e11, "volume_24h": 1.6e10, "price_change_1h": 0.18, "price_change_24h": 2.1, "price_change_7d": 5.5, "price": 3800},
    {"slug": "solana", "symbol": "SOL", "name": "Solana", "market_cap": 9e10, "volume_24h": 4e9, "price_change_1h": 0.35, "price_change_24h": 3.8, "price_change_7d": 9.0, "price": 220},
    {"slug": "arbitrum", "symbol": "ARB", "name": "Arbitrum", "market_cap": 3e9, "volume_24h": 3.5e8, "price_change_1h": 0.5, "price_change_24h": 4.5, "price_change_7d": 11.0, "price": 1.2},
    {"slug": "optimism", "symbol": "OP", "name": "Optimism", "market_cap": 2.5e9, "volume_24h": 2e8, "price_change_1h": 0.4, "price_change_24h": 3.9, "price_change_7d": 10.0, "price": 2.5},
    {"slug": "dogecoin", "symbol": "DOGE", "name": "Dogecoin", "market_cap": 2e10, "volume_24h": 9e8, "price_change_1h": 0.8, "price_change_24h": 5.2, "price_change_7d": 12.0, "price": 0.18},
    {"slug": "pepe", "symbol": "PEPE", "name": "Pepe", "market_cap": 4e9, "volume_24h": 5e8, "price_change_1h": 1.0, "price_change_24h": 6.0, "price_change_7d": 14.0, "price": 1e-5},
    {"slug": "fetch-ai", "symbol": "FET", "name": "Fetch.ai", "market_cap": 2e9, "volume_24h": 1.5e8, "price_change_1h": 0.6, "price_change_24h": 5.5, "price_change_7d": 13.0, "price": 1.8},
    {"slug": "bittensor", "symbol": "TAO", "name": "Bittensor", "market_cap": 3e9, "volume_24h": 8e7, "price_change_1h": 0.45, "price_change_24h": 4.8, "price_change_7d": 12.5, "price": 480},
    {"slug": "render-token", "symbol": "RNDR", "name": "Render", "market_cap": 2.5e9, "volume_24h": 1.2e8, "price_change_1h": 0.55, "price_change_24h": 5.1, "price_change_7d": 11.8, "price": 9.2},
    {"slug": "filecoin", "symbol": "FIL", "name": "Filecoin", "market_cap": 1.8e9, "volume_24h": 9e7, "price_change_1h": 0.3, "price_change_24h": 3.2, "price_change_7d": 8.0, "price": 5.5},
    {"slug": "chainlink", "symbol": "LINK", "name": "Chainlink", "market_cap": 1e10, "volume_24h": 4e8, "price_change_1h": 0.25, "price_change_24h": 2.9, "price_change_7d": 7.5, "price": 18},
]


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _risk_tier_from_volatility(vol_index: float) -> RiskTier:
    if vol_index < 33.34:
        return "low"
    if vol_index < 66.67:
        return "medium"
    return "high"


def _risk_soft_penalty(vol_index: float, risk: RiskTier | None) -> float:
    if risk is None:
        return 0.0
    tier = _risk_tier_from_volatility(vol_index)
    order = {"low": 0, "medium": 1, "high": 2}
    dist = abs(order[tier] - order[risk])
    return -float(dist) * 4.5


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


def _infer_social_from_turnover(tp: float) -> float:
    return _clamp(38.0 + tp * 0.45)


def _fetch_market_rows(max_rows: int = 750) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    page = 1
    per_page = 250
    max_pages = min(10, max(1, (max_rows + per_page - 1) // per_page))
    while len(rows) < max_rows and page <= max_pages:
        try:
            chunk = fetch_all_coins(per_page=per_page, page=page)
        except Exception as e:
            logger.warning("CoinGecko fetch_all_coins failed (page=%s): %s", page, e, exc_info=True)
            break
        if not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < per_page:
            break
        page += 1
    return rows


def _spread_display_scores(items: list[dict[str, Any]], *, floor: int = 40, ceiling: int = 95) -> None:
    n = len(items)
    if n <= 0:
        return
    step = max(1.0, (ceiling - floor) / max(1, n - 1))
    for i, it in enumerate(items):
        it["score"] = round(_clamp(ceiling - i * step + (float(it.get("_raw_sort", 50)) % 3) * 0.2, floor, ceiling), 2)


def _build_reasons(
    *,
    sym: str,
    mom: float,
    br: float,
    vel: float,
    rel: float,
    rot: float,
    trap: bool,
    stage: str,
    entry: str,
    mentions: int,
) -> list[str]:
    rs: list[str] = []
    if rel >= 58:
        rs.append(f"{sym} printing BTC+ bench strength on tape (rel strength {rel:.0f}/100).")
    if br >= 62:
        rs.append("Flow loading ahead of spot—turnover rank in upper cohort vs price pace.")
    if vel >= 58:
        rs.append("Velocity leaning short over 24h—tape speed building, not cooling.")
    if rot > 12:
        rs.append("Narrative sleeve catching bid in internal rotation score.")
    if mentions > 0:
        rs.append(f"RSS mention count {mentions} (24h) feeds attention sleeve.")
    if entry != "none":
        rs.append(f"Timing hint: {entry.replace('_', ' ')}.")
    if trap and len(rs) < 3:
        rs.append("Low-conviction impulse—price leading without flow confirmation.")
    if len(rs) < 3:
        rs.append(f"Cycle tag {stage}; momentum sleeve at {mom:.0f}/100 vs book.")
    return rs[:3]


def _regime_weights(w: dict[str, float], regime: str) -> dict[str, float]:
    out = dict(w)
    if regime == "RISK_ON":
        out["momentum"] = out.get("momentum", 0.2) * 1.08
        out["narrative"] = out.get("narrative", 0.2) * 1.08
        out["velocity"] = out.get("velocity", 0.1) * 1.05
    elif regime == "RISK_OFF":
        out["momentum"] = out.get("momentum", 0.2) * 0.92
        out["whale"] = out.get("whale", 0.15) * 1.08
        out["relative_strength"] = out.get("relative_strength", 0.05) * 1.05
    s = sum(out.values())
    return {k: out[k] / s for k in out}


def _score_candidates(
    rows: list[dict[str, Any]],
    *,
    ctx: BatchContext,
    timeframe: Timeframe,
    risk: RiskTier | None,
    news_scores: dict[str, float] | None,
    news_mentions_24h: dict[str, int] | None,
    hour_payload: dict[str, Any] | None,
    query_boost: frozenset[str],
    skip_mcap: bool,
    min_mcap: float | None,
    intent: QueryIntentResult | None = None,
) -> tuple[list[dict[str, Any]], int, int]:
    skipped_mcap = 0
    candidates: list[dict[str, Any]] = []
    for row in rows:
        mcap = row.get("market_cap")
        if not skip_mcap and min_mcap is not None and min_mcap > 0:
            try:
                if mcap is None or float(mcap) < float(min_mcap):
                    skipped_mcap += 1
                    continue
            except (TypeError, ValueError):
                skipped_mcap += 1
                continue

        slug = str(row.get("slug") or row.get("external_id") or "")
        base_inputs = CoinMarketInputs.from_coingecko_row(row)
        sym = base_inputs.symbol
        narrative = _hour_narrative_match(sym, slug, hour_payload)
        news_only = news_scores.get(sym) if news_scores else None
        merged_sent = _merge_sentiment(news_only, hour_payload, narrative)

        row_enriched = dict(row)
        tp = ctx.turnover_percentile(row)
        soc = row.get("social_score")
        if soc is None:
            row_enriched["social_score"] = _infer_social_from_turnover(tp)
        if merged_sent is not None:
            row_enriched["sentiment_score"] = merged_sent
        if news_only is not None:
            row_enriched["news_sentiment"] = news_only
        soc2 = _social_with_hour(row_enriched.get("social_score"), hour_payload, narrative)
        if soc2 is not None:
            row_enriched["social_score"] = soc2
        wh_inf = infer_whale_score(row, ctx)
        row_enriched["whale_score"] = wh_inf

        inputs = CoinMarketInputs.from_coingecko_row(row_enriched)
        scored = compute_alpha_score(inputs, timeframe=timeframe)
        mom, vol = momentum_volume_scores(row, timeframe)
        br = compute_breakout_score(row, ctx)
        vel = compute_velocity_score(row)
        narr_i = ctx.asset_narrative_intensity(sym, slug)
        rel = ctx.relative_strength_score(row)
        rot_b = ctx.narrative_flow_boost(sym, slug)
        qb = 15.0 if sym in query_boost else 0.0
        trap = low_conviction_trap(row, ctx, rot_b)

        w0 = _regime_weights(load_adaptive_weights(), ctx.market_regime)
        w = apply_intent_weight_multipliers(w0, intent.weight_mult if intent else {})
        comps = {
            "momentum": mom,
            "volume": vol,
            "narrative": narr_i,
            "breakout": br,
            "whale": wh_inf,
            "velocity": vel,
            "relative_strength": rel,
        }
        raw_core = compute_weighted_composite(comps, w)
        raw_core += rot_b * 0.35 + qb * 0.4
        raw_core += _risk_soft_penalty(scored.volatility_index, risk)
        if trap:
            raw_core -= 22.0
        raw_core = _clamp(raw_core)

        regime_ok = (ctx.market_regime == "RISK_ON" and mom >= 52) or (
            ctx.market_regime == "RISK_OFF" and rel >= 50
        ) or ctx.market_regime == "TRANSITION"
        cn, cflags = confluence_flags(
            row,
            ctx,
            breakout=br,
            velocity=vel,
            whale=wh_inf,
            narrative_intensity=narr_i,
            rel=rel,
            regime_ok=bool(regime_ok),
        )
        mult = 1.0
        for f in cflags[:4]:
            mult *= signal_reliability_multiplier(f)
        prob = 32.0 + cn * 9.0 + (raw_core - 50.0) * 0.35 + (15.0 if cn >= 4 else 0.0)
        prob *= mult
        prob = calibrate_probability_display(_clamp(prob))

        fac_vals = list(comps.values())
        try:
            st = statistics.pstdev(fac_vals) if len(fac_vals) > 1 else 10.0
        except statistics.StatisticsError:
            st = 10.0
        conf = _clamp(88.0 - st * 1.1 - (12.0 if trap else 0.0))

        sent_hint = news_only
        stage = classify_cycle_stage(row, ctx, sentiment_hint=sent_hint)
        entry = entry_zone_signal(row, ctx, stage, br)
        horizon = estimate_time_horizon(vel, br, 0)
        fresh = estimate_freshness(0, vel, None)

        mentions = (news_mentions_24h or {}).get(sym, 0)
        try:
            sp = float(row.get("price") or 0.0)
        except (TypeError, ValueError):
            sp = 0.0
        if sp <= 0:
            sp = 0.01
        reasons = _build_reasons(
            sym=sym,
            mom=mom,
            br=br,
            vel=vel,
            rel=rel,
            rot=rot_b,
            trap=trap,
            stage=stage,
            entry=entry,
            mentions=mentions,
        )

        narr_tags = sorted(narratives_for_asset(sym, slug))
        candidates.append(
            {
                "_raw_sort": raw_core,
                "asset": sym,
                "asset_symbol": sym,
                "name": row.get("name"),
                "coingecko_id": row.get("slug") or row.get("external_id"),
                "raw_alpha": round(raw_core, 3),
                "signals": scored.signals,
                "market_cap": mcap,
                "volume_24h": row.get("volume_24h"),
                "price_change_24h": inputs.price_change_24h,
                "price_change_7d": inputs.price_change_7d,
                "price_change_1h": row.get("price_change_1h"),
                "volatility_index": scored.volatility_index,
                "risk_tier": _risk_tier_from_volatility(scored.volatility_index),
                "news_mentions_24h": mentions,
                "hour_narrative_match": narrative,
                "narrative_flow_boost": rot_b,
                "query_boost_applied": qb > 0,
                "low_conviction_move": trap,
                "confidence_score": round(conf, 1),
                "probability_of_move": round(prob, 1),
                "confluence_score": cn,
                "confluence_flags": cflags,
                "cycle_stage": stage,
                "time_horizon": horizon,
                "signal_freshness": fresh,
                "entry_signal": entry,
                "rank_reasons": reasons,
                "factor_scores": {k: round(v, 2) for k, v in comps.items()},
                "narrative_tags": narr_tags,
                "spot_price": sp,
            }
        )
    return candidates, skipped_mcap, len(candidates)


def _score_single_opportunity_row(
    row: dict[str, Any],
    *,
    batch_ctx: BatchContext,
    timeframe: Timeframe,
    risk: RiskTier | None,
    news_scores: dict[str, float] | None,
    news_mentions_24h: dict[str, int] | None,
    hour_payload: dict[str, Any] | None,
    query_intent_result: QueryIntentResult | None,
) -> dict[str, Any] | None:
    qi = query_intent_result
    qb = frozenset(qi.boost_symbols) if qi else frozenset()
    candidates, _, n_scored = _score_candidates(
        [row],
        ctx=batch_ctx,
        timeframe=timeframe,
        risk=risk,
        news_scores=news_scores,
        news_mentions_24h=news_mentions_24h,
        hour_payload=hour_payload,
        query_boost=qb,
        skip_mcap=True,
        min_mcap=None,
        intent=qi,
    )
    if not candidates or n_scored <= 0:
        return None
    it = dict(candidates[0])
    if qi:
        apply_intent_post_scores(it, qi)
    _spread_display_scores([it], floor=42, ceiling=94)
    sp = it.get("spot_price")
    try:
        it["current_price"] = float(sp) if sp is not None else None
    except (TypeError, ValueError):
        it["current_price"] = None
    it.pop("spot_price", None)
    it.pop("_raw_sort", None)
    return it


def build_opportunity_from_markets_snapshot(
    slug: str,
    *,
    focus_symbol_upper: str | None = None,
    db: Session | None,
    batch_ctx: BatchContext,
    timeframe: Timeframe,
    risk: RiskTier | None,
    news_scores: dict[str, float] | None,
    news_mentions_24h: dict[str, int] | None,
    hour_payload: dict[str, Any] | None,
    query_intent_result: QueryIntentResult | None,
) -> dict[str, Any] | None:
    """CoinGecko /coins/markets first; if unavailable, DB Coin + latest MarketData (same scoring path)."""
    cid = (slug or "").lower().strip()
    if not cid:
        return None
    row: dict[str, Any] | None = None
    raw = fetch_coin_markets_row_by_id(cid)
    if raw:
        row = normalize_market_coin(raw)
    elif db is not None:
        row = normalized_market_row_from_db(db, cid)
    if row is None and focus_symbol_upper:
        row = minimal_row_for_major_slug(cid, focus_symbol_upper)
    if row is None:
        return None
    return _score_single_opportunity_row(
        row,
        batch_ctx=batch_ctx,
        timeframe=timeframe,
        risk=risk,
        news_scores=news_scores,
        news_mentions_24h=news_mentions_24h,
        hour_payload=hour_payload,
        query_intent_result=query_intent_result,
    )


def fetch_ranked_opportunities(
    limit: int = 10,
    timeframe: Timeframe = "24h",
    min_mcap: float | None = None,
    risk: RiskTier | None = None,
    news_scores: dict[str, float] | None = None,
    news_mentions_24h: dict[str, int] | None = None,
    hour_payload: dict[str, Any] | None = None,
    query_boost_symbols: frozenset[str] | None = None,
) -> list[dict[str, Any]]:
    bundle = fetch_intelligence_bundle(
        limit=limit,
        timeframe=timeframe,
        min_mcap=min_mcap,
        risk=risk,
        news_scores=news_scores,
        news_mentions_24h=news_mentions_24h,
        hour_payload=hour_payload,
        query_boost_symbols=query_boost_symbols,
    )
    return bundle["opportunities"]


def fetch_intelligence_bundle(
    *,
    limit: int = 10,
    timeframe: Timeframe = "24h",
    min_mcap: float | None = None,
    risk: RiskTier | None = None,
    news_scores: dict[str, float] | None = None,
    news_mentions_24h: dict[str, int] | None = None,
    hour_payload: dict[str, Any] | None = None,
    query_boost_symbols: frozenset[str] | None = None,
    skip_enqueue_predictions: bool = False,
    query_intent: QueryIntentResult | None = None,
) -> dict[str, Any]:
    limit_eff = max(5, min(limit, 100))
    max_rows = min(1500, max(400, limit_eff * 40))
    rows = _fetch_market_rows(max_rows=max_rows)
    synthetic = False
    if not rows:
        rows = list(_SYNTHETIC_MARKET)
        synthetic = True
        logger.warning("ai_intel: using synthetic market rows (CoinGecko empty)")

    qi = query_intent if query_intent is not None else parse_query_intent("")
    qb = frozenset(query_boost_symbols or frozenset()) | qi.boost_symbols
    ctx = BatchContext.build(rows, timeframe=timeframe, news_scores=news_scores, news_mentions=news_mentions_24h)

    primary, skipped_mcap, n_pri = _score_candidates(
        rows,
        ctx=ctx,
        timeframe=timeframe,
        risk=risk,
        news_scores=news_scores,
        news_mentions_24h=news_mentions_24h,
        hour_payload=hour_payload,
        query_boost=qb,
        skip_mcap=False,
        min_mcap=min_mcap,
        intent=qi,
    )
    out = list(primary)
    if len(out) < limit_eff and min_mcap is not None and min_mcap > 0:
        back, _, _ = _score_candidates(
            rows,
            ctx=ctx,
            timeframe=timeframe,
            risk=risk,
            news_scores=news_scores,
            news_mentions_24h=news_mentions_24h,
            hour_payload=hour_payload,
            query_boost=qb,
            skip_mcap=True,
            min_mcap=None,
            intent=qi,
        )
        seen = {x["asset_symbol"] for x in out}
        for x in sorted(back, key=lambda z: float(z["_raw_sort"]), reverse=True):
            if x["asset_symbol"] not in seen:
                seen.add(x["asset_symbol"])
                out.append(x)
            if len(out) >= limit_eff:
                break

    mode = qi.sort_mode

    def _sk(x: dict[str, Any]) -> tuple[float, ...]:
        return sort_key_for_mode(x, mode)

    matched = [c for c in out if candidate_matches_intent(c, qi)]
    rest = [c for c in out if not candidate_matches_intent(c, qi)]
    matched.sort(key=_sk)
    rest.sort(key=_sk)
    out = matched + rest
    for it in out:
        apply_intent_post_scores(it, qi)
    out.sort(key=_sk)
    for it in out:
        it["intent_primary_match"] = candidate_matches_intent(it, qi)

    for i, it in enumerate(out):
        rd = rank_delta_for_symbol(it["asset_symbol"], i)
        it["rank_delta"] = int(rd)
        it["time_horizon"] = estimate_time_horizon(
            float(it.get("factor_scores", {}).get("velocity", 50)),
            float(it.get("factor_scores", {}).get("breakout", 50)),
            int(rd),
        )
        fv = it.get("factor_scores") or {}
        it["signal_freshness"] = estimate_freshness(int(rd), float(fv.get("velocity", 50)), None)

    _spread_display_scores(out[:limit_eff], floor=42, ceiling=94)

    for it in out[: limit_eff]:
        it.pop("_raw_sort", None)

    final = out[:limit_eff]
    ranks = {str(o["asset_symbol"]): i for i, o in enumerate(final)}
    push_rank_snapshot(ranks)

    pred_recs: list[dict[str, Any]] = []
    if not skip_enqueue_predictions:
        for o in final[:10]:
            try:
                px = float(o.get("spot_price") or 0.01)
            except (TypeError, ValueError):
                px = 0.01
            if px <= 0:
                px = 0.01
            slug = str(o.get("coingecko_id") or "")
            pred_recs.append(
                build_prediction_record(
                    asset=str(o["asset_symbol"]),
                    coingecko_id=slug,
                    price=px,
                    probability=float(o.get("probability_of_move", 50)),
                    horizon=o.get("time_horizon") or "SHORT_TERM",
                    stage=str(o.get("cycle_stage") or "MID"),
                    signals=list(o.get("confluence_flags") or [])[:5],
                )
            )
        enqueue_prediction_records(pred_recs)

    for it in final:
        sp = it.get("spot_price")
        try:
            it["current_price"] = float(sp) if sp is not None else None
        except (TypeError, ValueError):
            it["current_price"] = None
        it.pop("spot_price", None)

    _preds = prediction_strings(ctx, ctx.market_regime)
    _shifts = recent_shift_strings(final)
    _portfolio = portfolio_buckets(final)
    _insights = model_insights_bullets()
    _seen_em: set[str] = set()
    _emerging: list[str] = []
    for _line in _shifts + _insights:
        if _line and _line not in _seen_em:
            _seen_em.add(_line)
            _emerging.append(_line)
    if not _emerging:
        _emerging = synthetic_emerging_signal_lines(ctx, final)

    logger.info(
        "ai_intel scored=%s skipped_mcap=%s synthetic=%s output=%s query_intent=%s",
        n_pri,
        skipped_mcap,
        synthetic,
        len(final),
        qi.to_log_dict(),
    )

    return {
        "opportunities": final,
        "market_regime": ctx.market_regime,
        "capital_rotation": ctx.capital_rotation,
        "synthetic_fallback": synthetic,
        "model_insights": _insights,
        "query_intent": qi.to_log_dict(),
        "predictions": _preds,
        "recent_shifts": _shifts,
        "emerging_signals": _emerging,
        "portfolio_positioning": _portfolio,
        "_batch_context": ctx,
    }


