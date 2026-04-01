"""Query classification: intent drives filters, composite weights, sort, and output mode."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Literal

from sqlalchemy.orm import Session

from app.models.coin import Coin
from app.services.ai_intelligence.narrative_map import narratives_for_asset
from app.services.connectors.coingecko_connector import search_coins

logger = logging.getLogger(__name__)

QueryIntentType = Literal[
    "DISCOVERY",
    "SECTOR",
    "ANALYSIS",
    "PREDICTION",
    "RISK",
    "SPECIFIC_ASSET",
]

_EXTRA_MAJORS = frozenset(
    {"BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOT", "ATOM", "LTC"}
)


def _coingecko_slug_registry_symbols() -> frozenset[str]:
    """Upper symbols from SLUG_TO_SYMBOL (CoinGecko canonical slug map)."""
    from app.api.v1.market import SLUG_TO_SYMBOL

    return frozenset(str(v).strip().upper() for v in SLUG_TO_SYMBOL.values() if v)


def _all_recognized_symbols() -> frozenset[str]:
    from app.services.ai_intelligence.narrative_map import _SYMBOL_TAGS  # type: ignore[attr-defined]

    return frozenset(_SYMBOL_TAGS.keys()) | _EXTRA_MAJORS | _coingecko_slug_registry_symbols()


def _first_query_token_upper(raw: str) -> str | None:
    parts = (raw or "").strip().split()
    if not parts:
        return None
    return parts[0].strip().upper().lstrip("$") or None


def _tickers_in_query(q: str) -> frozenset[str]:
    known = _all_recognized_symbols()
    found: set[str] = set()
    for m in re.finditer(r"\b([A-Za-z]{2,6})\b", q.upper()):
        t = m.group(1)
        if t in known:
            found.add(t)
    return frozenset(found)


def _sole_query_token(raw: str) -> str | None:
    parts = (raw or "").strip().split()
    if len(parts) != 1:
        return None
    return parts[0].strip()


def _expand_tickers_valid_sole_token(raw: str, tickers: frozenset[str], db: Session | None) -> frozenset[str]:
    """
    Tickers like XYO / PRE exist in our DB and on CoinGecko but are not in the static narrative map.
    Treat a single-token query as SPECIFIC_ASSET when the token matches a listed coin (DB) or CG search.
    """
    tok = _sole_query_token(raw)
    if not tok:
        return tickers
    sym_guess = tok.lstrip("$").upper()
    slug_lo = tok.lstrip("$").lower()

    if "-" in tok and db is not None:
        try:
            row = db.query(Coin).filter(Coin.slug == slug_lo).first()
            if row and row.symbol:
                su = str(row.symbol).strip().upper()
                if su:
                    return tickers | frozenset({su})
        except Exception as e:
            logger.debug("sole-token slug lookup %s: %s", slug_lo, e)
        return tickers

    if not re.fullmatch(r"[A-Za-z]{2,6}", sym_guess):
        return tickers

    if sym_guess in tickers:
        return tickers

    if db is not None:
        try:
            row = db.query(Coin).filter(Coin.symbol == sym_guess).first()
            if row is None:
                row = db.query(Coin).filter(Coin.slug == slug_lo).first()
            if row is not None and row.symbol:
                su = str(row.symbol).strip().upper()
                if su:
                    return tickers | frozenset({su})
        except Exception as e:
            logger.debug("sole-token db lookup %s: %s", sym_guess, e)

    if len(sym_guess) < 3:
        return tickers

    try:
        hits = search_coins(sym_guess) or []
    except Exception as e:
        logger.debug("sole-token search_coins %s: %s", sym_guess, e)
        return tickers
    sym_low = sym_guess.lower()
    for h in hits:
        if not isinstance(h, dict):
            continue
        if str(h.get("symbol") or "").strip().lower() == sym_low:
            return tickers | frozenset({sym_guess})
    return tickers


def _symbol_actionable_as_focus(sym: str, db: Session | None) -> bool:
    """Ticker can drive SPECIFIC_ASSET / ANALYSIS (why-is) even if not in static maps."""
    su = (sym or "").strip().upper()
    if not su:
        return False
    if su in _all_recognized_symbols():
        return True
    if db is not None:
        try:
            if db.query(Coin).filter(Coin.symbol == su).first():
                return True
        except Exception as e:
            logger.debug("actionable focus db %s: %s", su, e)
    try:
        hits = search_coins(su) or []
    except Exception as e:
        logger.debug("actionable focus cg %s: %s", su, e)
        return False
    s_low = su.lower()
    for h in hits:
        if isinstance(h, dict) and str(h.get("symbol") or "").strip().lower() == s_low:
            return True
    return False


def _sector_narratives_from_query(qlow: str) -> frozenset[str] | None:
    tags: set[str] = set()
    if re.search(r"\bai\b|artificial\s+intelligence|machine\s+learning|ai\s+coins?", qlow):
        tags.add("AI")
    if re.search(r"\bl2\b|layer\s*2|rollup|arbitrum|optimism|starknet", qlow):
        tags.add("L2")
    if re.search(r"\bmeme|doge|pepe|shib|bonk|wif|floki", qlow):
        tags.add("MEME")
    if re.search(r"\bdepin|de-pin|helium", qlow):
        tags.add("DEPIN")
    if re.search(r"\bgaming|gamefi|metaverse|axie", qlow):
        tags.add("GAMING")
    if re.search(r"\brwa|real\s+world|tokenized|ondo", qlow):
        tags.add("RWA")
    if re.search(r"\binfra|infrastructure|oracles?", qlow):
        tags.add("INFRA")
    return frozenset(tags) if tags else None


def _peer_narratives_for_symbols(syms: frozenset[str]) -> frozenset[str]:
    out: set[str] = set()
    for s in syms:
        out |= set(narratives_for_asset(s, ""))
    return frozenset(out)


@dataclass
class QueryIntentResult:
    intent: QueryIntentType
    filter_narratives: frozenset[str] | None = None
    focus_symbols: frozenset[str] = field(default_factory=frozenset)
    peer_narratives: frozenset[str] | None = None
    weight_mult: dict[str, float] = field(default_factory=dict)
    prob_bias: float = 0.0
    conf_mult: float = 1.0
    sort_mode: Literal["default", "prediction_focus", "safety_focus", "sector_compare"] = "default"
    prefer_low_volatility: bool = False
    boost_symbols: frozenset[str] = field(default_factory=frozenset)
    output_mode: str = "ranked_opportunities"
    strict_ticker_match: bool = False

    def to_log_dict(self) -> dict[str, Any]:
        return {
            "intent": self.intent,
            "filter_narratives": sorted(self.filter_narratives) if self.filter_narratives else None,
            "focus_symbols": sorted(self.focus_symbols),
            "peer_narratives": sorted(self.peer_narratives) if self.peer_narratives else None,
            "weight_mult": dict(self.weight_mult),
            "prob_bias": self.prob_bias,
            "conf_mult": self.conf_mult,
            "sort_mode": self.sort_mode,
            "prefer_low_volatility": self.prefer_low_volatility,
            "boost_symbols": sorted(self.boost_symbols),
            "output_mode": self.output_mode,
            "strict_ticker_match": self.strict_ticker_match,
        }


def _sector_tickers_for_narratives(nids: frozenset[str]) -> frozenset[str]:
    from app.services.ai_intelligence.narrative_map import _SYMBOL_TAGS  # type: ignore[attr-defined]

    out: set[str] = set()
    for sym, tags in _SYMBOL_TAGS.items():
        if tags & nids:
            out.add(sym)
    return frozenset(out)


def _leading_ticker_specific_asset_intent(raw: str, tickers: frozenset[str]) -> QueryIntentResult | None:
    """First token is the only ticker in the query → SPECIFIC_ASSET (before sector/discovery)."""
    if len(tickers) != 1:
        return None
    only = next(iter(tickers))
    first = _first_query_token_upper(raw)
    if first != only:
        return None
    strict_whole = len(raw.strip().split()) == 1
    peers = _peer_narratives_for_symbols(tickers)
    res = QueryIntentResult(
        intent="SPECIFIC_ASSET",
        focus_symbols=tickers,
        peer_narratives=peers if peers else None,
        weight_mult={"narrative": 1.2, "relative_strength": 1.08},
        prob_bias=3.0,
        sort_mode="sector_compare",
        boost_symbols=tickers,
        output_mode="asset_breakdown_with_peers",
        strict_ticker_match=strict_whole,
    )
    logger.info(
        "ai_intel_query_intent query=%r detected_symbol=%r intent=%s coin_mode_triggered=%s strict_ticker_match=%s",
        raw.strip(),
        only,
        res.intent,
        True,
        res.strict_ticker_match,
    )
    return res


def parse_query_intent(query: str, db: Session | None = None) -> QueryIntentResult:
    raw = (query or "").strip()
    qlow = raw.lower()
    tickers = _expand_tickers_valid_sole_token(raw, _tickers_in_query(raw), db)
    sector_tags = _sector_narratives_from_query(qlow)

    if re.search(
        r"\b(safe|safest|low\s*risk|should\s+i\s+sell|avoid\s+risk|capital\s*preservation|defensive)\b",
        qlow,
    ):
        return QueryIntentResult(
            intent="RISK",
            weight_mult={"relative_strength": 1.18, "whale": 1.12, "momentum": 0.88, "velocity": 0.9},
            prob_bias=-4.0,
            conf_mult=1.08,
            sort_mode="safety_focus",
            prefer_low_volatility=True,
            boost_symbols=tickers,
            output_mode="risk_aware_ranking",
        )

    if re.search(
        r"\b(what\s+will\s+pump|what\s+moves?\s+next|next\s+to\s+(pump|run)|about\s+to\s+move|"
        r"early\s+runners?|before\s+it\s+moves)\b",
        qlow,
    ):
        bm = set(tickers)
        if sector_tags:
            bm |= set(_sector_tickers_for_narratives(sector_tags))
        return QueryIntentResult(
            intent="PREDICTION",
            filter_narratives=sector_tags,
            weight_mult={"velocity": 1.22, "momentum": 1.12, "breakout": 1.1, "narrative": 1.08},
            prob_bias=10.0,
            conf_mult=0.97,
            sort_mode="prediction_focus",
            boost_symbols=frozenset(bm),
            output_mode="anticipatory_movers",
        )

    m_why = re.search(
        r"why\s+(?:is\s+)?([a-z0-9]{2,8})\s+(?:pumping|up|moving|rallying|surging)",
        qlow,
    )
    if m_why:
        sym = m_why.group(1).upper()
        if _symbol_actionable_as_focus(sym, db):
            peers = _peer_narratives_for_symbols(frozenset({sym}))
            return QueryIntentResult(
                intent="ANALYSIS",
                focus_symbols=frozenset({sym}),
                peer_narratives=peers if peers else None,
                weight_mult={"momentum": 1.15, "volume": 1.12, "narrative": 1.1},
                prob_bias=2.0,
                sort_mode="default",
                boost_symbols=frozenset({sym}),
                output_mode="single_asset_deep",
            )

    early_asset = _leading_ticker_specific_asset_intent(raw, tickers)
    if early_asset is not None:
        return early_asset

    if len(tickers) >= 1 and re.search(r"\b(vs|versus|compare|and)\b", qlow) and len(tickers) <= 4:
        peers_m: frozenset[str] | None = None
        for s in tickers:
            peers_n = _peer_narratives_for_symbols(frozenset({s}))
            if peers_n:
                peers_m = peers_n if peers_m is None else peers_m | peers_n
        return QueryIntentResult(
            intent="SPECIFIC_ASSET",
            focus_symbols=tickers,
            peer_narratives=peers_m,
            weight_mult={"relative_strength": 1.1, "narrative": 1.12},
            sort_mode="sector_compare",
            boost_symbols=tickers,
            output_mode="compare_assets",
        )

    if sector_tags and re.search(
        r"\b(coins?|tokens?|sector|narrative|play|exposure|basket|names?)\b",
        qlow,
    ):
        st_set = set(_sector_tickers_for_narratives(sector_tags))
        return QueryIntentResult(
            intent="SECTOR",
            filter_narratives=sector_tags,
            weight_mult={"narrative": 1.32, "velocity": 1.08},
            prob_bias=4.0,
            sort_mode="sector_compare",
            boost_symbols=frozenset(st_set),
            output_mode="sector_comparison",
        )

    if sector_tags:
        st_set = set(_sector_tickers_for_narratives(sector_tags))
        return QueryIntentResult(
            intent="SECTOR",
            filter_narratives=sector_tags,
            weight_mult={"narrative": 1.28, "momentum": 1.06},
            prob_bias=5.0,
            sort_mode="sector_compare",
            boost_symbols=frozenset(st_set),
            output_mode="sector_comparison",
        )

    if re.search(
        r"\b(best\s+crypto|top\s+coins?|what\s+to\s+buy|ideas?|opportunities|"
        r"scanners?|leaders?|movers?)\b",
        qlow,
    ):
        return QueryIntentResult(
            intent="DISCOVERY",
            sort_mode="default",
            boost_symbols=tickers,
            output_mode="global_ranked",
        )

    return QueryIntentResult(
        intent="DISCOVERY",
        boost_symbols=tickers,
        output_mode="global_ranked",
    )


def row_passes_intent_filter(row: dict[str, Any], qi: QueryIntentResult) -> bool:
    sym = str((row.get("symbol") or "")).strip().upper()
    slug = str(row.get("slug") or row.get("external_id") or "")
    tags = narratives_for_asset(sym, slug)

    if qi.focus_symbols and sym in qi.focus_symbols:
        return True
    if qi.peer_narratives and tags & qi.peer_narratives:
        return True
    if qi.filter_narratives:
        return bool(tags & qi.filter_narratives)
    return True


def apply_intent_weight_multipliers(w: dict[str, float], mult: dict[str, float]) -> dict[str, float]:
    if not mult:
        return dict(w)
    out = {k: float(w.get(k, 0.0)) * float(mult.get(k, 1.0)) for k in w}
    s = sum(max(0.0, v) for v in out.values())
    if s <= 0:
        return dict(w)
    return {k: max(0.01, out[k]) / s for k in out}


def apply_intent_post_scores(row: dict[str, Any], qi: QueryIntentResult) -> None:
    try:
        p = float(row.get("probability_of_move", 50)) + qi.prob_bias
        row["probability_of_move"] = round(max(5.0, min(95.0, p)), 1)
    except (TypeError, ValueError):
        pass
    try:
        c = float(row.get("confidence_score", 50)) * qi.conf_mult
        row["confidence_score"] = round(max(5.0, min(100.0, c)), 1)
    except (TypeError, ValueError):
        pass
    if qi.prefer_low_volatility:
        try:
            vi = float(row.get("volatility_index") or 50)
            if vi > 60:
                row["_raw_sort"] = float(row.get("_raw_sort", 50)) - 8.0
        except (TypeError, ValueError):
            pass


def sort_key_for_mode(x: dict[str, Any], mode: str) -> tuple[float, ...]:
    prob = -float(x.get("probability_of_move", 0))
    conf = -float(x.get("confidence_score", 0))
    cn = -int(x.get("confluence_score", 0))
    late = 1.0 if x.get("cycle_stage") == "LATE" else 0.0
    raw = -float(x.get("_raw_sort", 0))
    early_boost = 0.0
    if x.get("cycle_stage") == "EARLY":
        early_boost = -15.0
    if mode == "prediction_focus":
        return (prob, early_boost, cn, late, raw)
    if mode == "safety_focus":
        vi = float(x.get("volatility_index") or 50)
        return (conf, vi, prob, cn, late, raw)
    if mode == "sector_compare":
        return (prob, early_boost, cn, raw, late)
    return (prob, early_boost, cn, late, raw)

def candidate_matches_intent(c: dict[str, Any], qi: QueryIntentResult) -> bool:
    if qi.intent == "DISCOVERY" and not qi.filter_narratives and not qi.focus_symbols:
        return True
    sym = str(c.get("asset_symbol") or "").upper()
    tags = frozenset(c.get("narrative_tags") or [])
    if qi.focus_symbols:
        if sym in qi.focus_symbols:
            return True
        if qi.peer_narratives and tags & qi.peer_narratives:
            return True
        return False
    if qi.peer_narratives and tags & qi.peer_narratives:
        return True
    if qi.filter_narratives:
        return bool(tags & qi.filter_narratives)
    return True

