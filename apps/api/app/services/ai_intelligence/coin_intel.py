"""Assemble coin-mode intelligence payload: hero, positioning, prediction, signals, news hook, related."""

from __future__ import annotations

import hashlib
from typing import Any, Literal

from sqlalchemy.orm import Session

from app.services.ai_intelligence.alpha_batch import BatchContext
from app.services.ai_intelligence.news_signals import build_coin_news_slice

Direction = Literal["UP", "DOWN", "RANGE"]
Strength = Literal["Strong", "Moderate", "Weak"]

FLAG_TO_TEXT = {
    "breakout": "Breakout confluence is the lead driver — flow loading ahead of spot.",
    "velocity": "Velocity is the lead driver — tape speed building into the move.",
    "narrative": "Narrative intensity is the lead driver — thematic bid is active.",
    "rel_strength": "Relative strength vs majors is the lead driver.",
    "whale": "Whale/liquidity skew is contributing meaningfully.",
    "regime": "Macro regime alignment is reinforcing the setup.",
}


def _f(x: Any) -> float:
    try:
        v = float(x)
        return v if v == v else 0.0
    except (TypeError, ValueError):
        return 0.0


def _confidence_tier(conf: float) -> Literal["High", "Medium", "Low"]:
    if conf >= 68:
        return "High"
    if conf >= 52:
        return "Medium"
    return "Low"


def _strength_tier(prob: float, cn: int, vel: float) -> Strength:
    if prob >= 62 and cn >= 4 and vel >= 55:
        return "Strong"
    if prob >= 50 and cn >= 3:
        return "Moderate"
    return "Weak"


def _direction(row: dict[str, Any]) -> Direction:
    trap = bool(row.get("low_conviction_move"))
    stage = str(row.get("cycle_stage") or "MID")
    pc = _f(row.get("price_change_24h"))
    if trap or stage == "EXIT":
        return "RANGE" if pc > -3 else "DOWN"
    if stage == "EARLY" and pc > 2:
        return "UP"
    if stage == "LATE" and pc > 8:
        return "RANGE"
    if pc >= 1.5:
        return "UP"
    if pc <= -2:
        return "DOWN"
    return "RANGE"


def _horizon_display(th: str) -> str:
    t = (th or "SHORT_TERM").upper()
    if t == "IMMEDIATE":
        return "6–24h"
    if t == "SHORT_TERM":
        return "6–48h"
    if t == "DEVELOPING":
        return "1–3d"
    return "6–48h"


def _variants(key: str, *options: str, seed: int = 0) -> str:
    if not options:
        return ""
    idx = (seed + hash(key) % 1000) % len(options)
    return options[idx]


def _rotation_phase_for_tags(
    capital_rotation: list[dict[str, Any]], tags: list[str]
) -> str | None:
    if not capital_rotation or not tags:
        return None
    tagset = {t.upper() for t in tags}
    for row in capital_rotation:
        nid = str(row.get("narrative_id") or "")
        if nid.upper() in tagset or nid in tags:
            return str(row.get("phase") or "")
    return None


def _narrative_inflow_phrase(phase: str | None, seed: int) -> str | None:
    if phase in ("strong_inflow", "early_inflow"):
        return _variants(
            "rot_in",
            "Capital rotation into this sector is supporting continued demand.",
            "Narrative sleeves show inflow, keeping bid interest constructive.",
            seed=seed,
        )
    if phase == "capital_exiting":
        return _variants(
            "rot_out",
            "Sector flow is skewing defensive — demand may fade without fresh leadership.",
            "Capital rotation telemetry shows distribution in the matched narrative bucket.",
            seed=seed,
        )
    return None


def assemble_coin_narrative(
    *,
    row: dict[str, Any],
    batch_ctx: BatchContext,
    capital_rotation: list[dict[str, Any]],
    seed: int,
) -> dict[str, Any]:
    """Deterministic hero, positioning, risk, entry copy from row + context."""
    sym = str(row.get("asset_symbol") or "")
    stage = str(row.get("cycle_stage") or "MID")
    conf = _f(row.get("confidence_score"))
    prob = _f(row.get("probability_of_move"))
    cn = int(row.get("confluence_score") or 0)
    fv = row.get("factor_scores") or {}
    mom = _f(fv.get("momentum"))
    vol = _f(fv.get("volume"))
    nar = _f(fv.get("narrative"))
    vel = _f(fv.get("velocity"))
    rs = _f(fv.get("relative_strength"))
    trap = bool(row.get("low_conviction_move"))
    fresh = str(row.get("signal_freshness") or "")
    entry = str(row.get("entry_signal") or "none")
    tier = _confidence_tier(conf)
    th = str(row.get("time_horizon") or "SHORT_TERM")
    direction = _direction(row)
    strength = _strength_tier(prob, cn, vel)

    conf_lex = {
        "High": ("clear alignment", "strong confirmation"),
        "Medium": ("developing alignment", "constructive signals"),
        "Low": ("mixed signals", "early or unconfirmed setup"),
    }[tier]
    conf_phrase = _variants("conf", *conf_lex, seed=seed)

    stage_lex = {
        "EARLY": ("early positioning", "initial accumulation phase"),
        "MID": ("trend continuation", "momentum phase"),
        "LATE": ("extended move", "late-cycle behavior"),
        "EXIT": ("distribution", "weak follow-through"),
    }.get(stage, ("tape balanced", "mixed participation"))

    stage_phrase = _variants("stage", *stage_lex, seed=seed)

    # Hero headline
    dir_labels = {
        "UP": _variants("up", "Bullish continuation", "Upside bias holding", seed=seed),
        "DOWN": _variants("dn", "Soft tape / defensive tone", "Downside pressure watch", seed=seed),
        "RANGE": _variants("rg", "Range / balance", "Consolidation regime", seed=seed),
    }[direction]
    hero = (
        f"{sym}: {dir_labels} with {stage_phrase} — horizon {_horizon_display(th)} · "
        f"{tier} confidence ({conf_phrase})"
    )

    clauses: list[str] = []
    tags = list(row.get("narrative_tags") or [])
    rot_phase = _rotation_phase_for_tags(capital_rotation, tags)
    nph = _narrative_inflow_phrase(rot_phase, seed)
    if nph:
        clauses.append(nph)

    if vol >= mom + 5 and vol >= 55:
        clauses.append(
            _variants(
                "vol_lead",
                "Volume expansion is leading price action — often an early accumulation signal.",
                "Liquidity is expanding ahead of spot — participation is building.",
                seed=seed,
            )
        )
    if rs >= 58 and "rel_strength" in (row.get("confluence_flags") or []):
        clauses.append(
            _variants(
                "rs",
                "Outperformance vs BTC suggests active capital allocation into this asset.",
                "Relative strength vs majors is elevated — leadership characteristics on display.",
                seed=seed,
            )
        )
    if vel >= 58 and nar >= 55:
        clauses.append(
            "Momentum is accelerating alongside narrative inflows, reinforcing continuation conditions."
        )
    elif mom >= 58:
        clauses.append(
            _variants(
                "mom",
                "Momentum factors are carrying the tape — watch for confirmation on the next reset.",
                "Price momentum is the dominant driver in this snapshot.",
                seed=seed,
            )
        )

    if not clauses:
        clauses.append(
            f"Tape reads {stage_phrase} with {conf_phrase} — lean on structured prediction and risk context."
        )

    pos_line1 = clauses[0]
    pos_line2 = None
    if len(clauses) > 1 and tier != "Low":
        pos_line2 = clauses[1]
    elif len(clauses) > 1:
        pos_line2 = clauses[1] if prob >= 55 else None

    positioning_lines = [pos_line1] + ([pos_line2] if pos_line2 else [])

    # Risk
    vi = _f(row.get("volatility_index"))
    risk_lines: list[str] = []
    if stage == "LATE":
        risk_lines.append(
            _variants(
                "rk_late",
                "Late-cycle behavior — crowded positioning elevates reversal risk on failed follow-through.",
                "Extended move profile — treat strength as vulnerable to mean reversion.",
                seed=seed,
            )
        )
    elif stage == "EXIT":
        risk_lines.append("Exit-stage tone — distribution and weak follow-through raise unwind risk.")
    elif trap:
        risk_lines.append(
            "Low-conviction trap flagged — price outran participation; reposition only after confirmation."
        )
    elif fresh == "EXHAUSTED":
        risk_lines.append("Signal freshness reads exhausted — velocity may be fading.")
    elif vi >= 62:
        risk_lines.append("Volatility index elevated — expect wider swings over the near term.")
    else:
        risk_lines.append(
            _variants(
                "rk_mid",
                "Mid-cycle positioning — moderate two-way risk until the next catalyst sequence.",
                "Balanced volatility profile — risk is ordinary, not complacent.",
                seed=seed,
            )
        )

    # Entry context
    entry_ctx = None
    if entry and entry != "none":
        labels = {
            "pullback_entry": "Pullback entry",
            "breakout_continuation": "Breakout continuation",
            "accumulation_zone": "Accumulation zone",
        }
        expl = {
            "pullback_entry": "Recent price structure hints at a digestion/pullback versus prior impulse — confirmation still required.",
            "breakout_continuation": "Breakout-style leadership with momentum still engaged — watch for follow-through volume.",
            "accumulation_zone": "Turnover and stage suggest accumulation characteristics — treat breaks as validation.",
        }
        pc1 = _f(row.get("price_change_1h"))
        pc24 = _f(row.get("price_change_24h"))
        extra = ""
        if entry == "breakout_continuation" and pc24 > 3 and pc1 < pc24 / 4:
            extra = " Consolidation after an upward move points to continuation-style structure."
        entry_ctx = {
            "label": labels.get(entry, entry.replace("_", " ").title()),
            "explanation": expl.get(entry, "Engine tagged an entry zone — confirmation still required.") + extra,
        }

    return {
        "hero_call": {
            "headline": hero,
            "direction_label": dir_labels,
            "timeframe_label": _horizon_display(th),
            "confidence_tier": tier,
        },
        "positioning_insight": {"lines": positioning_lines[:2]},
        "risk_context": {"lines": risk_lines[:2]},
        "entry_context": entry_ctx,
        "prediction": {
            "direction": direction,
            "horizon": th,
            "horizon_display": _horizon_display(th),
            "strength": strength,
        },
    }


def _related_buckets(primary: dict[str, Any], opportunities: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    psym = str(primary.get("asset_symbol") or "")
    ptags = set(primary.get("narrative_tags") or [])
    peers = [
        o
        for o in opportunities
        if str(o.get("asset_symbol") or "") != psym
        and ptags & set(o.get("narrative_tags") or [])
    ]

    def score_key(o: dict[str, Any]) -> tuple[float, float]:
        st = str(o.get("cycle_stage") or "MID")
        late_boost = 1.0 if st in ("LATE", "MID") else 0.0
        return (late_boost, _f(o.get("score")))

    leaders = sorted(peers, key=score_key, reverse=True)[:4]
    early = [o for o in peers if str(o.get("cycle_stage") or "") == "EARLY"]
    early_sorted = sorted(early, key=lambda o: _f(o.get("score")), reverse=True)[:4]
    if len(early_sorted) < 2:
        early_sorted = sorted(
            [o for o in peers if o not in leaders],
            key=lambda o: _f(o.get("probability_of_move")),
            reverse=True,
        )[:4]

    def slim(o: dict[str, Any]) -> dict[str, Any]:
        return {
            "asset_symbol": o.get("asset_symbol"),
            "name": o.get("name"),
            "coingecko_id": o.get("coingecko_id"),
            "score": o.get("score"),
            "cycle_stage": o.get("cycle_stage"),
            "probability_of_move": o.get("probability_of_move"),
        }

    return {
        "narrative_leaders": [slim(x) for x in leaders],
        "earlier_stage": [slim(x) for x in early_sorted],
    }


def build_coin_intel(
    db: Session,
    *,
    primary: dict[str, Any],
    opportunities: list[dict[str, Any]],
    batch_ctx: BatchContext,
    capital_rotation: list[dict[str, Any]],
    query_intent: dict[str, Any],
    timeframe: str,
) -> dict[str, Any]:
    sym = str(primary.get("asset_symbol") or "")
    slug = str(primary.get("coingecko_id") or "").strip()
    h = hashlib.sha256(
        f"{sym}|{primary.get('cycle_stage')}|{primary.get('confluence_score')}|{','.join(primary.get('confluence_flags') or [])}".encode()
    ).digest()
    seed = int.from_bytes(h[:4], "big") % 1_000_000

    narrative = assemble_coin_narrative(
        row=primary,
        batch_ctx=batch_ctx,
        capital_rotation=capital_rotation,
        seed=seed,
    )

    fv = primary.get("factor_scores") or {}
    pc24 = _f(primary.get("price_change_24h"))
    pc7 = _f(primary.get("price_change_7d")) if timeframe == "7d" else pc24
    bench_btc = batch_ctx.btc_change_24h if timeframe == "24h" else batch_ctx.btc_change_7d
    bench_eth = batch_ctx.eth_change_24h if timeframe == "24h" else batch_ctx.eth_change_7d
    vs_btc = round(pc24 - bench_btc, 2) if timeframe == "24h" else round(pc7 - batch_ctx.btc_change_7d, 2)
    vs_eth = round(pc24 - bench_eth, 2) if timeframe == "24h" else round(pc7 - batch_ctx.eth_change_7d, 2)

    news = build_coin_news_slice(db, sym, hours=48)

    flags = list(primary.get("confluence_flags") or [])
    if flags:
        lead = flags[0]
        primary_driver = FLAG_TO_TEXT.get(lead, f"{lead.replace('_', ' ').title()} signal cluster is leading.")
    else:
        primary_driver = "Confluence stack is balanced — no single dominant factor flagged."

    supporting: list[str] = [
        FLAG_TO_TEXT.get(f, f.replace("_", " ").title()) for f in flags[1:4] if f
    ]

    tag_summary: list[dict[str, Any]] = []
    for t in primary.get("narrative_tags") or []:
        ph = _rotation_phase_for_tags(capital_rotation, [t])
        tag_summary.append({"narrative_id": t, "phase": ph})

    coin_page: dict[str, Any] = {"slug": slug or None, "href": f"/coins/{slug}" if slug else None}

    signals_out = {"primary_driver": primary_driver, "supporting": [s for s in supporting if s][:3]}

    return {
        **narrative,
        "overview": {
            "symbol": sym,
            "name": primary.get("name"),
            "current_price": primary.get("current_price"),
            "score": primary.get("score"),
            "confidence_score": primary.get("confidence_score"),
            "probability_of_move": primary.get("probability_of_move"),
            "cycle_stage": primary.get("cycle_stage"),
            "entry_signal": primary.get("entry_signal"),
        },
        "signals": signals_out,
        "relative_strength": {
            "vs_btc_pct": vs_btc,
            "vs_eth_pct": vs_eth,
            "score": _f(fv.get("relative_strength")),
        },
        "narrative_flow": tag_summary,
        "news_insight": {"lines": news.insight_lines, "headline_count": news.headline_count, "sentiment_score": news.sentiment_score},
        "headlines": news.headlines,
        "related": _related_buckets(primary, opportunities),
        "coin_page": coin_page,
        "query_intent": query_intent,
    }
