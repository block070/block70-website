from __future__ import annotations

import pytest

from app.services.ai_intelligence.adaptive_model import (
    calibrate_probability_display,
    resolve_pending_outcomes,
)
from app.services.ai_intelligence.opportunity_pipeline import fetch_intelligence_bundle
from app.services.ai_intelligence.query_sector_hints import sector_symbols_for_query


@pytest.fixture(autouse=True)
def disable_redis_market_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    """Avoid slow Redis connection attempts during cache reads in CI/dev."""
    monkeypatch.setattr("app.services.connectors.market_cache._get_redis", lambda: None)


def test_sector_symbols_for_query_ai() -> None:
    s = sector_symbols_for_query("What is the AI token narrative today?")
    assert "FET" in s or "TAO" in s


def test_sector_symbols_for_query_l2() -> None:
    s = sector_symbols_for_query("Layer 2 rollup ecosystem")
    assert "ARB" in s or "OP" in s


def test_synthetic_fallback_nonempty_ranked_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.ai_intelligence.opportunity_pipeline.fetch_all_coins",
        lambda **kwargs: [],
    )
    b = fetch_intelligence_bundle(limit=8, skip_enqueue_predictions=True)
    assert b["synthetic_fallback"] is True
    assert len(b["opportunities"]) >= 5
    assert isinstance(b["market_regime"], str)
    assert "probability_of_move" in b["opportunities"][0]
    assert "confidence_score" in b["opportunities"][0]


def test_bundle_includes_predictions_shifts_portfolio(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.ai_intelligence.opportunity_pipeline.fetch_all_coins",
        lambda **kwargs: [],
    )
    b = fetch_intelligence_bundle(limit=5, skip_enqueue_predictions=True)
    assert "predictions" in b and isinstance(b["predictions"], list)
    assert "recent_shifts" in b and isinstance(b["recent_shifts"], list)
    assert "emerging_signals" in b and isinstance(b["emerging_signals"], list)
    assert len(b["emerging_signals"]) >= 1
    assert "portfolio_positioning" in b and isinstance(b["portfolio_positioning"], dict)
    o = b["opportunities"][0]
    assert "current_price" in o


def test_emerging_signals_synthetic_when_shifts_and_insights_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.ai_intelligence.opportunity_pipeline.fetch_all_coins",
        lambda **kwargs: [],
    )
    monkeypatch.setattr(
        "app.services.ai_intelligence.opportunity_pipeline.recent_shift_strings",
        lambda *a, **k: [],
    )
    monkeypatch.setattr(
        "app.services.ai_intelligence.opportunity_pipeline.model_insights_bullets",
        lambda: [],
    )
    b = fetch_intelligence_bundle(limit=5, skip_enqueue_predictions=True)
    assert len(b["emerging_signals"]) >= 1
    joined = " ".join(b["emerging_signals"]).lower()
    assert b["market_regime"].lower() in joined or "transitional" in joined or "risk-on" in joined or "risk-off" in joined
    assert all(isinstance(s, str) and s.strip() for s in b["emerging_signals"])


def test_enriched_opportunity_has_phase_d_e_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.ai_intelligence.opportunity_pipeline.fetch_all_coins",
        lambda **kwargs: [],
    )
    b = fetch_intelligence_bundle(limit=5, skip_enqueue_predictions=True)
    o = b["opportunities"][0]
    for k in (
        "cycle_stage",
        "entry_signal",
        "confluence_score",
        "rank_delta",
        "signal_freshness",
        "time_horizon",
        "rank_reasons",
    ):
        assert k in o


def test_resolve_pending_drops_closed_from_queue(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.ai_intelligence import adaptive_model as am

    pending_rec = {
        "id": "t1",
        "status": "pending",
        "ts": 0.0,
        "predicted_horizon": "IMMEDIATE",
        "coingecko_id": "bitcoin",
        "price_at_prediction": 100.0,
        "signals_present": ["breakout_velocity"],
        "predicted_probability": 60.0,
    }

    def fake_get(_key: str, _ttl: int, **_kw):
        return {"pending": [pending_rec]}

    last_val: dict | None = None

    def fake_set(_key: str, _ttl: int, val: dict, **_kw):
        nonlocal last_val
        last_val = val

    monkeypatch.setattr(am, "market_cache_get", fake_get)
    monkeypatch.setattr(am, "market_cache_set", fake_set)
    monkeypatch.setattr(
        am,
        "fetch_coin_markets_row_by_id",
        lambda _cid: {"current_price": 105.0},
    )
    n = resolve_pending_outcomes()
    assert n == 1
    assert last_val is not None
    assert last_val.get("pending") == []


def test_calibrate_probability_display_bounds() -> None:
    x = calibrate_probability_display(102.0)
    assert 5.0 <= x <= 95.0


def test_save_adaptive_weights_clamps_and_normalizes(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.ai_intelligence import adaptive_model as am

    captured: dict[str, float] = {}

    def capture_set(_k: str, _t: int, val: dict, **_kw):
        captured.clear()
        captured.update(val)

    monkeypatch.setattr(am, "market_cache_set", capture_set)
    extreme = {k: 0.99 for k in am._DEFAULT_W}
    am.save_adaptive_weights(extreme)
    assert captured
    for v in captured.values():
        assert 0.03 <= float(v) <= 0.45
    assert abs(sum(float(x) for x in captured.values()) - 1.0) < 1e-5

def test_query_intent_ai_sector_vs_best_crypto() -> None:
    from app.services.ai_intelligence.query_intent import parse_query_intent

    a = parse_query_intent("AI coins to watch")
    b = parse_query_intent("best crypto opportunities today")
    assert a.intent == "SECTOR"
    assert b.intent == "DISCOVERY"
    assert a.filter_narratives is not None and "AI" in a.filter_narratives
    assert b.filter_narratives is None


def test_parse_intent_sole_token_xyo_when_coingecko_confirms(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.ai_intelligence.query_intent import parse_query_intent

    def fake_search(q: str) -> list[dict]:
        if str(q).strip().upper() == "XYO":
            return [{"id": "xyo-network", "symbol": "xyo", "name": "XYO Network"}]
        return []

    monkeypatch.setattr("app.services.ai_intelligence.query_intent.search_coins", fake_search)
    r = parse_query_intent("XYO", None)
    assert r.intent == "SPECIFIC_ASSET"
    assert "XYO" in r.focus_symbols


def test_parse_intent_sole_token_pre_db_coin(monkeypatch: pytest.MonkeyPatch) -> None:
    from unittest.mock import MagicMock

    from app.services.ai_intelligence.query_intent import parse_query_intent

    pre_row = MagicMock()
    pre_row.symbol = "PRE"
    qmock = MagicMock()
    qmock.filter = MagicMock(return_value=qmock)
    qmock.first = MagicMock(side_effect=[pre_row, None])

    db = MagicMock()
    db.query = MagicMock(return_value=qmock)

    monkeypatch.setattr("app.services.ai_intelligence.query_intent.search_coins", lambda _q: [])

    r = parse_query_intent("PRE", db)
    assert r.intent == "SPECIFIC_ASSET"
    assert r.focus_symbols == frozenset({"PRE"})


def test_parse_intent_why_is_xyo_when_actionable(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.ai_intelligence.query_intent import parse_query_intent

    def fake_search(q: str) -> list[dict]:
        if str(q).strip().upper() == "XYO":
            return [{"id": "xyo-network", "symbol": "xyo"}]
        return []

    monkeypatch.setattr("app.services.ai_intelligence.query_intent.search_coins", fake_search)
    r = parse_query_intent("why is XYO pumping", None)
    assert r.intent == "ANALYSIS"
    assert "XYO" in r.focus_symbols


def test_query_intent_strict_ticker_ada_and_dollar_prefix() -> None:
    from app.services.ai_intelligence.query_intent import parse_query_intent

    for q in ("ADA", "  ada  ", "$ADA"):
        r = parse_query_intent(q)
        assert r.intent == "SPECIFIC_ASSET"
        assert r.focus_symbols == frozenset({"ADA"})
        assert r.strict_ticker_match is True


def test_query_intent_leading_ticker_not_limited_by_query_length() -> None:
    from app.services.ai_intelligence.query_intent import parse_query_intent

    r = parse_query_intent("ADA long form query that exceeds twelve characters easily")
    assert r.intent == "SPECIFIC_ASSET"
    assert r.focus_symbols == frozenset({"ADA"})
    assert r.strict_ticker_match is False


def test_finalize_preserves_query_intent_on_coin_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    from unittest.mock import MagicMock

    from app.api.v1.ai_intelligence import _finalize_opportunities_response
    from app.services.ai_intelligence.query_intent import parse_query_intent

    def fake_fetch(**kwargs: object) -> dict:
        del kwargs
        qid = parse_query_intent("").to_log_dict()
        return {
            "opportunities": [{"asset_symbol": "BTC", "coingecko_id": "bitcoin"}],
            "market_regime": "TRANSITION",
            "capital_rotation": [],
            "synthetic_fallback": False,
            "model_insights": [],
            "query_intent": qid,
            "predictions": [],
            "recent_shifts": [],
            "portfolio_positioning": {},
            "_batch_context": MagicMock(),
        }

    monkeypatch.setattr("app.api.v1.ai_intelligence.fetch_intelligence_bundle", fake_fetch)
    monkeypatch.setattr(
        "app.api.v1.ai_intelligence.build_opportunity_from_markets_snapshot",
        lambda *a, **k: None,
    )

    ada_qi = parse_query_intent("ADA").to_log_dict()
    bundle = {
        "opportunities": [{"asset_symbol": "ETH", "coingecko_id": "ethereum"}],
        "market_regime": "TRANSITION",
        "capital_rotation": [],
        "synthetic_fallback": False,
        "model_insights": [],
        "query_intent": ada_qi,
        "predictions": [],
        "recent_shifts": [],
        "portfolio_positioning": {},
        "_batch_context": MagicMock(),
    }
    out = _finalize_opportunities_response(
        MagicMock(),
        bundle,
        timeframe="24h",
        news_agg=MagicMock(scores={}, mentions_24h={}),
        hour_pl={},
        limit=10,
        min_mcap=None,
        risk=None,
        query_normalized="ADA",
    )
    assert out["query_intent"]["intent"] == "SPECIFIC_ASSET"
    assert "ADA" in (out["query_intent"].get("focus_symbols") or [])
    assert out["coin_fallback"] is True
    assert out["coin_intel"] is None
    assert out["opportunities"][0]["asset_symbol"] == "BTC"


def test_resolve_coingecko_slug_ada_inverse_no_db() -> None:
    from app.services.ai_intelligence.coin_slug_resolve import resolve_coingecko_slug_for_ticker

    assert resolve_coingecko_slug_for_ticker(None, "ADA") == "cardano"
    assert resolve_coingecko_slug_for_ticker(None, "BTC") == "bitcoin"


def test_build_opportunity_from_markets_snapshot(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.ai_intelligence.alpha_batch import BatchContext
    from app.services.ai_intelligence.opportunity_pipeline import (
        _SYNTHETIC_MARKET,
        build_opportunity_from_markets_snapshot,
    )
    from app.services.ai_intelligence.query_intent import parse_query_intent

    ctx = BatchContext.build(list(_SYNTHETIC_MARKET), timeframe="24h")

    def fake_fetch(_cid: str) -> dict:
        return {
            "id": "cardano",
            "name": "Cardano",
            "symbol": "ada",
            "image": "",
            "market_cap_rank": 8,
            "market_cap": 1e10,
            "current_price": 0.52,
            "total_volume": 2e8,
            "circulating_supply": None,
            "total_supply": None,
            "price_change_percentage_1h_in_currency": 0.1,
            "price_change_percentage_24h": 2.1,
            "price_change_percentage_7d_in_currency": 4.5,
        }

    monkeypatch.setattr(
        "app.services.ai_intelligence.opportunity_pipeline.fetch_coin_markets_row_by_id",
        fake_fetch,
    )
    row = build_opportunity_from_markets_snapshot(
        "cardano",
        db=None,
        batch_ctx=ctx,
        timeframe="24h",
        risk=None,
        news_scores=None,
        news_mentions_24h=None,
        hour_payload=None,
        query_intent_result=parse_query_intent("ADA"),
    )
    assert row is not None
    assert row.get("asset_symbol") == "ADA"
    assert row.get("coingecko_id") == "cardano"
    assert row.get("current_price") is not None
    assert "probability_of_move" in row
    assert "_raw_sort" not in row


def test_build_opportunity_major_slug_fallback_without_cg_or_db(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.ai_intelligence.alpha_batch import BatchContext
    from app.services.ai_intelligence.opportunity_pipeline import (
        _SYNTHETIC_MARKET,
        build_opportunity_from_markets_snapshot,
    )
    from app.services.ai_intelligence.query_intent import parse_query_intent

    ctx = BatchContext.build(list(_SYNTHETIC_MARKET), timeframe="24h")
    monkeypatch.setattr(
        "app.services.ai_intelligence.opportunity_pipeline.fetch_coin_markets_row_by_id",
        lambda _cid: None,
    )
    monkeypatch.setattr(
        "app.services.ai_intelligence.opportunity_pipeline.normalized_market_row_from_db",
        lambda *_a, **_k: None,
    )
    row = build_opportunity_from_markets_snapshot(
        "cardano",
        focus_symbol_upper="ADA",
        db=None,
        batch_ctx=ctx,
        timeframe="24h",
        risk=None,
        news_scores=None,
        news_mentions_24h=None,
        hour_payload=None,
        query_intent_result=parse_query_intent("ADA"),
    )
    assert row is not None
    assert row.get("asset_symbol") == "ADA"
    assert row.get("coingecko_id") == "cardano"


def test_build_opportunity_db_fallback_when_coingecko_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    from unittest.mock import MagicMock

    from app.services.ai_intelligence.alpha_batch import BatchContext
    from app.services.ai_intelligence.opportunity_pipeline import (
        _SYNTHETIC_MARKET,
        build_opportunity_from_markets_snapshot,
    )
    from app.services.ai_intelligence.query_intent import parse_query_intent

    ctx = BatchContext.build(list(_SYNTHETIC_MARKET), timeframe="24h")
    monkeypatch.setattr(
        "app.services.ai_intelligence.opportunity_pipeline.fetch_coin_markets_row_by_id",
        lambda _cid: None,
    )

    def fake_db_row(_db: object, slug: str) -> dict:
        assert slug == "cardano"
        return {
            "external_id": "cardano",
            "name": "Cardano",
            "symbol": "ADA",
            "slug": "cardano",
            "market_cap": 1e10,
            "price": 0.55,
            "volume_24h": 1.5e8,
            "price_change_24h": 1.2,
            "price_change_7d": 3.0,
        }

    monkeypatch.setattr(
        "app.services.ai_intelligence.opportunity_pipeline.normalized_market_row_from_db",
        fake_db_row,
    )
    row = build_opportunity_from_markets_snapshot(
        "cardano",
        db=MagicMock(),
        batch_ctx=ctx,
        timeframe="24h",
        risk=None,
        news_scores=None,
        news_mentions_24h=None,
        hour_payload=None,
        query_intent_result=parse_query_intent("ADA"),
    )
    assert row is not None
    assert row.get("asset_symbol") == "ADA"
    assert row.get("coingecko_id") == "cardano"


def test_finalize_hydrates_off_ranked_coin(monkeypatch: pytest.MonkeyPatch) -> None:
    from unittest.mock import MagicMock

    from app.api.v1.ai_intelligence import _finalize_opportunities_response
    from app.services.ai_intelligence.query_intent import parse_query_intent

    def fake_hydrate(*_a: object, **_k: object) -> dict:
        return {
            "asset_symbol": "ADA",
            "coingecko_id": "cardano",
            "name": "Cardano",
            "cycle_stage": "MID",
            "confluence_score": 3,
            "confluence_flags": ["momentum"],
            "factor_scores": {"relative_strength": 52.0},
            "price_change_24h": 1.0,
            "price_change_7d": 2.0,
            "probability_of_move": 52.0,
            "confidence_score": 60.0,
            "current_price": 0.5,
            "narrative_tags": [],
        }

    def spy_intel(_db: object, **kw: object) -> dict:
        assert kw["primary"]["asset_symbol"] == "ADA"
        return {"overview": {"symbol": "ADA"}, "stub": True}

    monkeypatch.setattr(
        "app.api.v1.ai_intelligence.build_opportunity_from_markets_snapshot",
        fake_hydrate,
    )
    monkeypatch.setattr("app.api.v1.ai_intelligence.build_coin_intel", spy_intel)

    ada_qi = parse_query_intent("ADA").to_log_dict()
    bundle = {
        "opportunities": [{"asset_symbol": "ETH", "coingecko_id": "ethereum"}],
        "market_regime": "TRANSITION",
        "capital_rotation": [],
        "synthetic_fallback": False,
        "model_insights": [],
        "query_intent": ada_qi,
        "predictions": [],
        "recent_shifts": [],
        "portfolio_positioning": {},
        "_batch_context": MagicMock(),
    }
    out = _finalize_opportunities_response(
        MagicMock(),
        bundle,
        timeframe="24h",
        news_agg=MagicMock(scores={}, mentions_24h={}),
        hour_pl={},
        limit=10,
        min_mcap=None,
        risk=None,
        query_normalized="ADA",
    )
    assert out["coin_fallback"] is False
    assert out["coin_intel"] is not None
    assert out["coin_intel"].get("stub") is True
    assert out["opportunities"][0]["asset_symbol"] == "ETH"


def test_bundle_respects_query_intent_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.ai_intelligence.query_intent import parse_query_intent

    monkeypatch.setattr(
        "app.services.ai_intelligence.opportunity_pipeline.fetch_all_coins",
        lambda **kwargs: [],
    )
    qi = parse_query_intent("meme coins")
    b = fetch_intelligence_bundle(limit=12, skip_enqueue_predictions=True, query_intent=qi)
    assert b["query_intent"]["intent"] == "SECTOR"
    prim = [x for x in b["opportunities"] if x.get("intent_primary_match")]
    assert prim, "expected at least one primary meme match in synthetic book"
    for x in prim:
        assert "MEME" in (x.get("narrative_tags") or [])
