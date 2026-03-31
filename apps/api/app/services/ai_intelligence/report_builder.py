"""Formatted reports, predictions, portfolio buckets from computed meta."""

from __future__ import annotations

from typing import Any, Literal

from app.services.ai_intelligence.alpha_batch import BatchContext, MarketRegime


def portfolio_buckets(
    rows: list[dict[str, Any]],
) -> dict[str, list[str]]:
    leaders: list[str] = []
    early: list[str] = []
    acc: list[str] = []
    fading: list[str] = []
    for o in rows:
        sym = str(o.get("asset_symbol") or o.get("asset") or "")
        st = o.get("cycle_stage")
        conf = float(o.get("confidence_score") or 50)
        trap = o.get("low_conviction_move")
        rot = float(o.get("narrative_flow_boost") or 0)
        if trap:
            fading.append(sym)
        elif st == "EXIT" or rot < -8:
            fading.append(sym)
        elif st == "EARLY" and conf > 45:
            acc.append(sym)
        elif rot > 10 and st in ("EARLY", "MID"):
            early.append(sym)
        elif conf > 55 and st in ("MID", "LATE"):
            leaders.append(sym)
        elif rot > 0:
            early.append(sym)
        else:
            leaders.append(sym)
    return {
        "leaders": leaders[:12],
        "early_rotation": early[:12],
        "accumulation_plays": acc[:12],
        "fading_assets": fading[:12],
    }


def prediction_strings(ctx: BatchContext, regime: MarketRegime) -> list[str]:
    out: list[str] = []
    top = ctx.capital_rotation[:3]
    if top:
        inf = [x["narrative_id"] for x in top if x.get("phase") in ("strong_inflow", "early_inflow")]
        if inf:
            out.append(f"Rotation skew favors {' / '.join(inf)} cohorts over the next 24–48h window.")
    ex = [x["narrative_id"] for x in ctx.capital_rotation[-2:] if x.get("phase") == "capital_exiting"]
    if ex:
        out.append(f"{', '.join(ex)} flow profile shows distribution — size trims into strength, not weakness.")
    if regime == "RISK_ON":
        out.append("Regime: risk-on tape — leadership expects to stay with high relative-strength alt sleeves.")
    elif regime == "RISK_OFF":
        out.append("Regime: capital hoarding BTC-tier liquidity — mean-reversion setups dominate short fuse.")
    if not out:
        out.append("Tape in transition — prioritize confluence (3+ independent signals) before size.")
    return out[:5]


def recent_shift_strings(rows: list[dict[str, Any]], top_n: int = 4) -> list[str]:
    lines: list[str] = []
    for o in rows[:top_n]:
        sym = o.get("asset_symbol") or o.get("asset")
        d = o.get("rank_delta")
        if sym and d and int(d) != 0:
            lines.append(f"{sym} velocity of rank: Δ{d:+d} vs prior engine pass.")
    return lines


def build_formatted_report(
    *,
    query: str,
    rows: list[dict[str, Any]],
    ctx: BatchContext,
    portfolio: dict[str, list[str]],
    predictions: list[str],
    shifts: list[str],
    model_insights: list[str],
) -> str:
    lines: list[str] = []
    lines.append("Top Opportunities:")
    for i, o in enumerate(rows[:10], 1):
        sym = o.get("asset_symbol") or o.get("asset")
        sc = o.get("score")
        cf = o.get("confidence_score")
        pr = o.get("probability_of_move")
        st = o.get("cycle_stage")
        rd = o.get("rank_delta")
        fr = o.get("signal_freshness")
        rdi = int(rd or 0)
        lines.append(
            f"{i}. {sym} — Alpha: {sc} | Confidence: {cf} | Probability: {pr} | Stage: {st} | ΔRank: {rdi:+d} | Freshness: {fr}"
        )
        for r in (o.get("rank_reasons") or [])[:3]:
            lines.append(f"   - {r}")
    lines.append("")
    lines.append("Capital Rotation:")
    for c in ctx.capital_rotation[:6]:
        lines.append(f"- {c['narrative_id']} → {c['phase']}")
    lines.append("")
    lines.append(f"Market Regime:\n- {ctx.market_regime}")
    lines.append("")
    lines.append("Portfolio Positioning:")
    for k, v in portfolio.items():
        lines.append(f"- {k}: {', '.join(v) if v else '—'}")
    lines.append("")
    if shifts:
        lines.append("Recent Shifts:")
        for s in shifts:
            lines.append(f"- {s}")
        lines.append("")
    lines.append("Emerging Signals:")
    lines.append(f"- {ctx.market_regime} breadth + narrative flow divergence across book.")
    lines.append("")
    lines.append("Predictions:")
    for p in predictions:
        lines.append(f"- {p}")
    if model_insights:
        lines.append("")
        lines.append("Model Insights:")
        for m in model_insights:
            lines.append(f"- {m}")
    lines.append("")
    lines.append("Summary:")
    lines.append(
        f"Query «{(query or '')[:160]}»: prioritize {rows[0].get('asset_symbol') if rows else '—'} confluence stack; "
        f"{'risk-on' if ctx.market_regime == 'RISK_ON' else 'defensive' if ctx.market_regime == 'RISK_OFF' else 'transitional'} "
        f"regime with {ctx.capital_rotation[0]['narrative_id'] if ctx.capital_rotation else 'mixed'} sleeve leading internal flow score."
    )
    return "\n".join(lines)
