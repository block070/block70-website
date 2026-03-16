from typing import List

from sqlalchemy.orm import Session

from app.models import Opportunity, OpportunitySignal
from app.services.connectors.jupiter_connector import fetch_or_mock
from app.services.signals.arbitrage_signals import (
    ArbitrageSignal,
    ArbitrageSignalExtractor,
)
from app.services.pipeline.opportunity_normalizer import OpportunityNormalizer
from app.services.scoring.scoring_engine import ScoringEngine, ScoringContext
from app.services.pipeline.deduplication import upsert_opportunity_by_identity
from app.services.pipeline.alpha_feed import emit_alpha_event_for_opportunity


class OpportunityPipeline:
    """
    Orchestrates the arbitrage opportunity pipeline:

    1. fetch raw quotes from arbitrage_mock_connector
    2. extract signals via arbitrage_signals
    3. normalize into opportunities
    4. score opportunities
    5. deduplicate existing opportunities
    6. persist to database
    """

    def __init__(self) -> None:
        self._signals = ArbitrageSignalExtractor()
        self._normalizer = OpportunityNormalizer()
        self._scoring = ScoringEngine()

    def run_arbitrage(self, db: Session) -> List[Opportunity]:
        # 1. Fetch raw quotes (live from Jupiter when possible, otherwise mock).
        quotes = fetch_or_mock()

        # 2. Extract arbitrage signals
        signals: List[ArbitrageSignal] = self._signals.extract(quotes)

        results: List[Opportunity] = []

        for signal in signals:
            v = signal.value

            # 3. Normalize into an OpportunityCreate (DB-oriented) skeleton.
            op_data = self._normalizer.normalize_arbitrage_db(signal)

            # 4. Score the opportunity using the generic scoring engine.
            spread_percent = float(v["spread_percent"])
            fees_percent = float(v["estimated_fees_percent"])
            net_edge_percent = max(spread_percent - fees_percent, 0.0)

            upside_score = min(max(net_edge_percent / 5.0, 0.0), 1.0)
            confidence_score = float(signal.confidence)
            freshness_score = 1.0  # mock data is "fresh" at extraction time
            liquidity_score = float(v["liquidity_score"])
            accessibility_score = 0.9  # Jupiter/Raydium/Orca are broadly accessible
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
            score_components = self._scoring.score(score_ctx)

            # Map score components back into the opportunity data structure.
            op_data.confidence_score = score_components.confidence_score
            op_data.upside_score = score_components.upside_score
            op_data.freshness_score = score_components.freshness_score
            op_data.liquidity_score = score_components.liquidity_score
            op_data.accessibility_score = score_components.accessibility_score
            op_data.risk_score = score_components.risk_score
            op_data.difficulty_score = score_components.difficulty_score
            op_data.total_score = score_components.total_score

            # 5. Deduplicate using natural identity (type, chain, asset_symbol, source_ref).
            asset_symbol = op_data.asset_symbol
            opportunity = Opportunity(
                title=op_data.title,
                slug=op_data.slug,
                type=op_data.type,
                chain=op_data.chain,
                status=op_data.status,
                summary=op_data.summary,
                thesis=op_data.thesis,
                asset_symbol=asset_symbol,
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
                raw_payload={
                    "signal": signal.model_dump(),
                },
            )

            persisted = upsert_opportunity_by_identity(db, opportunity)

            # 6. Attach signal reference as an OpportunitySignal row.
            signal_row = OpportunitySignal(
                opportunity_id=persisted.id,
                signal_type=signal.signal_type,
                signal_value=net_edge_percent,
                signal_weight=1.0,
                confidence=confidence_score,
                notes=None,
                source=op_data.source,
                external_id=signal.entity_id,
                payload=signal.value,
                detected_at=signal.timestamp,
                dedup_key=None,
            )
            db.add(signal_row)

            # 7. Emit a high-level AlphaEvent for use in activity feeds.
            emit_alpha_event_for_opportunity(db, persisted)

            results.append(persisted)

        db.commit()
        return results


