from typing import List, Optional

from sqlalchemy.orm import Session

import requests

from app.models import Opportunity, OpportunitySignal, WalletProfile
from app.services.connectors.jupiter_connector import fetch_live
from app.services.connectors.solana_wallet_connector import SolanaWalletConnector
from app.services.connectors.wallet_mock_connector import WalletActivityRaw
from app.services.signals.arbitrage_signals import (
    ArbitrageSignal,
    ArbitrageSignalExtractor,
)
from app.services.signals.wallet_signals import WalletSignalExtractor, WalletSignal
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
        # 1. Fetch raw quotes (live from Jupiter only).
        quotes = fetch_live()
        if not quotes:
            return []

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


    def run_wallet(self, db: Session) -> List[Opportunity]:
        """
        Strict real wallet pipeline (Solana).

        - Reads recent wallet activity from Solana JSON-RPC (no paid APIs).
        - Values SOL deltas using CoinGecko simple price endpoint.
        - Extracts wallet signals and persists wallet-type opportunities.
        - Upserts WalletProfile rows so /wallets/leaderboard can render.
        """
        connector = SolanaWalletConnector()
        events = connector.fetch_events(limit_per_wallet=10)
        if not events:
            return []

        sol_price = _get_sol_price_usd()
        raw_events: List[WalletActivityRaw] = []
        for ev in events:
            usd_value = float(ev.usd_value or 0.0)
            if usd_value <= 0 and sol_price is not None:
                usd_value = float(ev.amount) * float(sol_price)
            raw_events.append(
                WalletActivityRaw(
                    wallet_address=ev.wallet_address,
                    token_symbol=ev.token_symbol,
                    transaction_type=ev.transaction_type,
                    amount=float(ev.amount),
                    usd_value=float(usd_value),
                    timestamp=ev.timestamp,
                )
            )

        extractor = WalletSignalExtractor(min_usd_threshold=5_000.0)
        signals: List[WalletSignal] = extractor.extract(raw_events)
        if not signals:
            return []

        results: List[Opportunity] = []

        for signal in signals:
            op_data = self._normalizer.normalize_wallet_db(signal)

            # Ensure wallet leaderboard can count recent events by wallet address.
            wallet_address = signal.wallet_address

            opportunity = Opportunity(
                title=op_data.title,
                slug=op_data.slug,
                type=op_data.type,
                chain="solana",
                status=op_data.status,
                summary=op_data.summary,
                thesis=op_data.thesis,
                asset_symbol=wallet_address,  # used by leaderboard join
                base_symbol=op_data.base_symbol,
                quote_symbol=op_data.quote_symbol,
                source=op_data.source,
                source_ref=signal.wallet_address,
                estimated_cost=op_data.estimated_cost,
                estimated_upside=op_data.estimated_upside,
                estimated_roi_percent=op_data.estimated_roi_percent,
                confidence_score=op_data.confidence_score,
                upside_score=0.3,
                freshness_score=1.0,
                liquidity_score=0.0,
                accessibility_score=0.8,
                risk_score=0.6,
                difficulty_score=0.6,
                total_score=op_data.confidence_score,
                risk_level=op_data.risk_level,
                difficulty_level=op_data.difficulty_level,
                detected_at=op_data.detected_at,
                expires_at=op_data.expires_at,
                last_seen_at=op_data.last_seen_at,
                dedup_key=None,
                raw_payload={"signal": signal.model_dump()},
            )

            persisted = upsert_opportunity_by_identity(db, opportunity)

            db.add(
                OpportunitySignal(
                    opportunity_id=persisted.id,
                    signal_type=signal.signal_type,
                    signal_value=float(signal.usd_value),
                    signal_weight=1.0,
                    confidence=float(signal.confidence),
                    notes=None,
                    source=op_data.source,
                    external_id=None,
                    payload=signal.model_dump(),
                    detected_at=signal.timestamp,
                    dedup_key=None,
                )
            )

            _upsert_wallet_profile(db, wallet_address=wallet_address, last_activity=signal.timestamp)
            emit_alpha_event_for_opportunity(db, persisted)

            results.append(persisted)

        db.commit()
        return results


def _get_sol_price_usd() -> Optional[float]:
    """SOL price: Coinbase → Binance.US → CoinGecko."""
    from app.services.connectors.price_resolver import get_sol_price_usd

    return get_sol_price_usd()


def _upsert_wallet_profile(db: Session, *, wallet_address: str, last_activity) -> None:
    wp = db.query(WalletProfile).filter(WalletProfile.wallet_address == wallet_address).first()
    if wp is None:
        wp = WalletProfile(wallet_address=wallet_address, chain="solana")
        db.add(wp)

    wp.last_activity = last_activity
    wp.total_trades = int(wp.total_trades or 0) + 1
    wp.total_signals = int(wp.total_signals or 0) + 1
    # We do not compute ROI/win-rate without a full PnL engine; keep defaults.

