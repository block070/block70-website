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
    assert "portfolio_positioning" in b and isinstance(b["portfolio_positioning"], dict)
    o = b["opportunities"][0]
    assert "current_price" in o


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
