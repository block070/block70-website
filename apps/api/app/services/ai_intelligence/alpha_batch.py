"""Cross-sectional batch stats: regime, BTC/ETH bench, narrative rotation, turnover ranks."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Literal

from app.services.ai_intelligence.narrative_map import all_narrative_ids, narratives_for_asset

MarketRegime = Literal["RISK_ON", "RISK_OFF", "TRANSITION"]
RotationPhase = Literal["strong_inflow", "early_inflow", "steady", "capital_exiting"]


def _f(x: Any) -> float | None:
    if x is None:
        return None
    try:
        v = float(x)
        return v if v == v else None
    except (TypeError, ValueError):
        return None


def _turnover(row: dict[str, Any]) -> float | None:
    v = _f(row.get("volume_24h"))
    m = _f(row.get("market_cap"))
    if v is None or m is None or m <= 0:
        return None
    return v / m


def _percentile_rank(value: float, sorted_vals: list[float]) -> float:
    if not sorted_vals:
        return 50.0
    n = len(sorted_vals)
    below = sum(1 for x in sorted_vals if x < value)
    return _clamp(100.0 * below / max(1, n - 1) if n > 1 else 50.0)


def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


@dataclass
class BatchContext:
    rows: list[dict[str, Any]]
    timeframe: Literal["24h", "7d"]
    btc_change_24h: float = 0.0
    eth_change_24h: float = 0.0
    btc_change_7d: float = 0.0
    eth_change_7d: float = 0.0
    turnover_sorted: list[float] = field(default_factory=list)
    alt_changes_24h: list[float] = field(default_factory=list)
    market_regime: MarketRegime = "TRANSITION"
    narrative_stats: dict[str, dict[str, float]] = field(default_factory=dict)
    capital_rotation: list[dict[str, Any]] = field(default_factory=list)
    news_scores: dict[str, float] | None = None
    news_mentions: dict[str, int] | None = None

    @classmethod
    def build(
        cls,
        rows: list[dict[str, Any]],
        *,
        timeframe: Literal["24h", "7d"],
        news_scores: dict[str, float] | None = None,
        news_mentions: dict[str, int] | None = None,
    ) -> BatchContext:
        ctx = cls(rows=rows, timeframe=timeframe, news_scores=news_scores, news_mentions=news_mentions)
        slugs = {str(r.get("slug") or r.get("external_id") or "").lower() for r in rows}
        sym_lookup = {(r.get("symbol") or "").upper(): r for r in rows}

        def _row_chg_24(r: dict[str, Any]) -> float:
            return _f(r.get("price_change_24h")) or 0.0

        def _row_chg_7(r: dict[str, Any]) -> float:
            return _f(r.get("price_change_7d")) or 0.0

        btc_row = None
        for key in ("bitcoin",):
            if key in slugs:
                for r in rows:
                    if str(r.get("slug") or "").lower() == key:
                        btc_row = r
                        break
        eth_row = None
        for key in ("ethereum",):
            if key in slugs:
                for r in rows:
                    if str(r.get("slug") or "").lower() == key:
                        eth_row = r
                        break
        if btc_row:
            ctx.btc_change_24h = _row_chg_24(btc_row)
            ctx.btc_change_7d = _row_chg_7(btc_row)
        if eth_row:
            ctx.eth_change_24h = _row_chg_24(eth_row)
            ctx.eth_change_7d = _row_chg_7(eth_row)

        turns: list[float] = []
        alt_24: list[float] = []
        for r in rows:
            slug = str(r.get("slug") or "").lower()
            if slug in ("bitcoin", "ethereum"):
                continue
            t = _turnover(r)
            if t is not None and t > 0:
                turns.append(math.log10(t))
            pc = _f(r.get("price_change_24h"))
            if pc is not None:
                alt_24.append(pc)
        turns.sort()
        ctx.turnover_sorted = turns
        ctx.alt_changes_24h = alt_24

        bench = ctx.btc_change_24h
        if alt_24:
            beat = sum(1 for x in alt_24 if x > bench) / len(alt_24)
            med = sorted(alt_24)[len(alt_24) // 2]
            if beat >= 0.55 and med > bench:
                ctx.market_regime = "RISK_ON"
            elif beat <= 0.4 and med < bench:
                ctx.market_regime = "RISK_OFF"
            else:
                ctx.market_regime = "TRANSITION"

        # Per-narrative aggregates
        nid_stats: dict[str, list[float]] = {n: [] for n in all_narrative_ids()}
        nid_turn: dict[str, list[float]] = {n: [] for n in all_narrative_ids()}
        nid_mention: dict[str, float] = {n: 0.0 for n in all_narrative_ids()}
        mentions = news_mentions or {}

        for r in rows:
            sym = str(r.get("symbol") or "").upper()
            slug = str(r.get("slug") or "")
            tags = narratives_for_asset(sym, slug)
            pc = _f(r.get("price_change_24h") if timeframe == "24h" else r.get("price_change_7d"))
            if pc is None:
                pc = _f(r.get("price_change_24h")) or 0.0
            tr = _turnover(r)
            lt = math.log10(tr) if tr and tr > 0 else None
            for tag in tags:
                nid_stats[tag].append(pc)
                if lt is not None:
                    nid_turn[tag].append(lt)
                nid_mention[tag] += float(mentions.get(sym, 0))

        narrative_agg: dict[str, dict[str, float]] = {}
        global_avg_pc = sum(alt_24) / len(alt_24) if alt_24 else 0.0
        global_med_turn = turns[len(turns) // 2] if turns else -4.0
        for nid in all_narrative_ids():
            xs = nid_stats[nid]
            avg_pc = sum(xs) / len(xs) if xs else global_avg_pc
            avg_lt = sum(nid_turn[nid]) / len(nid_turn[nid]) if nid_turn[nid] else global_med_turn
            mention_z = nid_mention[nid]
            flow_raw = (avg_pc - global_avg_pc) * 0.4 + (avg_lt - global_med_turn) * 15.0 + mention_z * 0.8
            narrative_agg[nid] = {
                "avg_price_change": avg_pc,
                "avg_log_turnover": avg_lt,
                "mention_pulse": mention_z,
                "flow_raw": flow_raw,
            }
        ctx.narrative_stats = narrative_agg

        # Rank narratives by flow_raw
        ranked = sorted(narrative_agg.items(), key=lambda kv: kv[1]["flow_raw"], reverse=True)
        n = len(ranked)
        rotation: list[dict[str, Any]] = []
        for i, (nid, st) in enumerate(ranked):
            if n <= 1:
                phase: RotationPhase = "steady"
            elif i < n // 4:
                phase = "strong_inflow" if st["flow_raw"] > 0 else "early_inflow"
            elif i >= 3 * n // 4:
                phase = "capital_exiting"
            elif st["flow_raw"] > 0:
                phase = "early_inflow"
            else:
                phase = "steady"
            rotation.append({"narrative_id": nid, "label": nid, "phase": phase, "flow_score": round(st["flow_raw"], 3)})
        ctx.capital_rotation = rotation
        return ctx

    def turnover_percentile(self, row: dict[str, Any]) -> float:
        tr = _turnover(row)
        if tr is None or tr <= 0 or not self.turnover_sorted:
            return 50.0
        lt = math.log10(tr)
        return _percentile_rank(lt, self.turnover_sorted)

    def relative_strength_score(self, row: dict[str, Any]) -> float:
        """0-100: outperform BTC/ETH = high."""
        pc = _f(row.get("price_change_24h")) if self.timeframe == "24h" else _f(row.get("price_change_7d"))
        if pc is None:
            pc = _f(row.get("price_change_24h")) or 0.0
        bench = max(self.btc_change_24h, self.eth_change_24h) if self.timeframe == "24h" else max(self.btc_change_7d, self.eth_change_7d)
        edge = pc - bench
        return _clamp(50.0 + edge * 2.5)

    def narrative_flow_boost(self, symbol: str, slug: str) -> float:
        """-20..+30 adjustment from narrative rotation tier."""
        tags = narratives_for_asset(symbol, slug)
        if not tags:
            return 0.0
        ranks = {r["narrative_id"]: i for i, r in enumerate(self.capital_rotation)}
        best = min(ranks.get(t, 99) for t in tags)
        worst = max(ranks.get(t, 0) for t in tags)
        n = max(1, len(self.capital_rotation))
        if best <= n // 4:
            return 22.0
        if best <= n // 2:
            return 12.0
        if worst >= 3 * n // 4:
            return -15.0
        return 0.0

    def asset_narrative_intensity(self, symbol: str, slug: str) -> float:
        tags = narratives_for_asset(symbol, slug)
        if not tags:
            return 45.0
        vals = [self.narrative_stats[t]["flow_raw"] for t in tags if t in self.narrative_stats]
        if not vals:
            return 45.0
        raw = sum(vals) / len(vals)
        return _clamp(50.0 + raw * 3.0)
