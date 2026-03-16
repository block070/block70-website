from __future__ import annotations

from typing import Any, Dict, List, Sequence

from sqlalchemy.orm import Session

from app.models import Opportunity
from app.services.scoring.scoring_engine import ScoringContext, ScoringEngine
from app.services.signals.arbitrage_signals import (
    ArbitrageSignal,
    ArbitrageSignalExtractor,
)
from app.services.signals.github_signals import (
    GitHubActivitySignal,
    GitHubActivitySignalExtractor,
)
from app.services.signals.social_signals import (
    SocialActivitySignal,
    SocialSignalExtractor,
)
from app.services.signals.wallet_signals import WalletSignal, WalletSignalExtractor
from app.services.streaming.event_stream import ack_events, consume_events
from app.services.connectors.arbitrage_mock_connector import ArbitrageQuote
from app.services.connectors.github_activity_connector import GitHubRepoActivityRaw
from app.services.connectors.social_signal_connector import SocialActivityRaw
from app.services.connectors.wallet_mock_connector import WalletActivityRaw
from app.services.pipeline.opportunity_normalizer import OpportunityNormalizer
from app.services.pipeline.deduplication import upsert_opportunity_by_identity
from app.services.pipeline.alpha_feed import emit_alpha_event_for_opportunity


def _forward_wallet_signals_to_engine(
    db: Session,
    signals: Sequence[WalletSignal],
) -> None:
    """
    Placeholder hook for integrating wallet-derived signals into the
    broader Opportunity Engine.

    For now this simply exists as an extension point; existing wallet
    pipelines still handle their own normalization and scoring.
    """
    # In a future iteration, this can call into a dedicated wallet
    # opportunity normalizer / scorer that mirrors the main pipeline.
    if not signals:
        return


def _forward_social_signals_to_engine(
    db: Session,
    signals: Sequence[SocialActivitySignal],
) -> None:
    if not signals:
        return


def _forward_github_signals_to_engine(
    db: Session,
    signals: Sequence[GitHubActivitySignal],
) -> None:
    if not signals:
        return


def _forward_arbitrage_signals_to_engine(
    db: Session,
    signals: Sequence[ArbitrageSignal],
) -> None:
    """
    Minimal integration path for arbitrage-related StreamEvents into the
    existing arbitrage normalization / scoring pipeline.
    """
    if not signals:
        return

    normalizer = OpportunityNormalizer()
    scoring = ScoringEngine()

    for signal in signals:
        v = signal.value

        op_data = normalizer.normalize_arbitrage_db(signal)

        spread_percent = float(v["spread_percent"])
        fees_percent = float(v["estimated_fees_percent"])
        net_edge_percent = max(spread_percent - fees_percent, 0.0)

        upside_score = min(max(net_edge_percent / 5.0, 0.0), 1.0)
        confidence_score = float(signal.confidence)
        freshness_score = 1.0
        liquidity_score = float(v["liquidity_score"])
        accessibility_score = 0.9
        risk_score = 1.0 - min(confidence_score, 1.0)
        difficulty_score = 0.3 if liquidity_score >= 0.8 else (
            0.6 if liquidity_score >= 0.4 else 0.8
        )

        score_ctx = ScoringContext(
            upside_score=upside_score,
            confidence_score=confidence_score,
            freshness_score=freshness_score,
            liquidity_score=liquidity_score,
            accessibility_score=accessibility_score,
            risk_score=risk_score,
            difficulty_score=difficulty_score,
            execution_feasibility_score=float(
                v.get("execution_feasibility", 0.5)
            ),
        )
        score_components = scoring.score(score_ctx)

        op_data.confidence_score = score_components.confidence_score
        op_data.upside_score = score_components.upside_score
        op_data.freshness_score = score_components.freshness_score
        op_data.liquidity_score = score_components.liquidity_score
        op_data.accessibility_score = score_components.accessibility_score
        op_data.risk_score = score_components.risk_score
        op_data.difficulty_score = score_components.difficulty_score
        op_data.total_score = score_components.total_score

        opportunity = Opportunity(
            title=op_data.title,
            slug=op_data.slug,
            type=op_data.type,
            chain=op_data.chain,
            status=op_data.status,
            summary=op_data.summary,
            thesis=op_data.thesis,
            asset_symbol=op_data.asset_symbol,
            base_symbol=op_data.base_symbol,
            quote_symbol=op_data.quote_symbol,
            source=op_data.source,
            source_ref=op_data.source_ref,
            estimated_cost=op_data.estimated_cost,
            estimated_upside=op_data.estimated_upside,
            estimated_roi_percent=op_data.estimated_roi_percent,
            confidence_score=op_data.confidence_score,
            upside_score=op_data.upside_score,
            freshness_score=op_data.freshness_score,
            liquidity_score=op_data.liquidity_score,
            accessibility_score=op_data.accessibility_score,
            risk_score=op_data.risk_score,
            difficulty_score=op_data.difficulty_score,
            total_score=op_data.total_score,
            risk_level=op_data.risk_level,
            difficulty_level=op_data.difficulty_level,
            detected_at=op_data.detected_at,
            expires_at=op_data.expires_at,
            last_seen_at=op_data.last_seen_at,
            dedup_key=None,
            raw_payload={"signal": signal.model_dump()},
        )

        persisted = upsert_opportunity_by_identity(db, opportunity)
        emit_alpha_event_for_opportunity(db, persisted)

    db.commit()


def run_event_consumer(
    db: Session,
    *,
    group: str = "opportunity-engine",
    consumer: str = "worker-1",
    max_events: int = 100,
) -> None:
    """
    Consume StreamEvents from Redis, route them by type, run the appropriate
    signal extractors, and forward resulting signals into the Opportunity
    Engine or related systems.

    Pipeline:
    1) read StreamEvents via Redis Streams consumer group
    2) route events by type
    3) call corresponding signal extractor
    4) forward signals to Opportunity Engine
    """
    raw_events = consume_events(
        group=group,
        consumer=consumer,
        count=max_events,
        block_ms=1000,
    )

    if not raw_events:
        return

    wallet_raw: list[WalletActivityRaw] = []
    social_raw: list[SocialActivityRaw] = []
    github_raw: list[GitHubRepoActivityRaw] = []
    arbitrage_raw: list[ArbitrageQuote] = []

    for ev in raw_events:
        etype = ev.get("event_type")
        payload: Dict[str, Any] = ev.get("payload") or {}

        if etype == "wallet_transaction":
            try:
                wallet_raw.append(WalletActivityRaw(**payload))
            except Exception:
                continue
        elif etype in ("dex_trade", "liquidity_change"):
            try:
                arbitrage_raw.append(ArbitrageQuote(**payload))
            except Exception:
                continue
        elif etype == "dev_activity":
            try:
                github_raw.append(GitHubRepoActivityRaw(**payload))
            except Exception:
                continue
        elif etype == "social_signal":
            try:
                social_raw.append(SocialActivityRaw(**payload))
            except Exception:
                continue
        elif etype == "price_update":
            # Price updates can feed trend / narrative detection; left as a
            # future extension point for now.
            continue

    # Run extractors
    if wallet_raw:
        wallet_signals = WalletSignalExtractor().extract(wallet_raw)
        _forward_wallet_signals_to_engine(db, wallet_signals)

    if social_raw:
        social_signals = SocialSignalExtractor().extract(social_raw)
        _forward_social_signals_to_engine(db, social_signals)

    if github_raw:
        github_signals = GitHubActivitySignalExtractor().extract(github_raw)
        _forward_github_signals_to_engine(db, github_signals)

    if arbitrage_raw:
        arb_signals = ArbitrageSignalExtractor().extract(arbitrage_raw)
        _forward_arbitrage_signals_to_engine(db, arb_signals)

    # Acknowledge processed messages so Redis does not redeliver them.
    stream_ids = [e.get("stream_id") for e in raw_events if e.get("stream_id")]
    if stream_ids:
        ack_events(group=group, stream_ids=stream_ids)

