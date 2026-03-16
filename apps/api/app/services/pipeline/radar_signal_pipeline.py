from __future__ import annotations

from typing import List

from sqlalchemy.orm import Session

from app.models import Opportunity, RadarSignal
from app.services.signals.wallet_signals import WalletSignal
from app.services.signals.narrative_signals import NarrativeSignal
from app.services.connectors.github_connector import GitHubProjectActivityRaw


class RadarSignalPipeline:
    """
    Pipeline for generating Crypto Radar signals from existing data sources.

    Inputs include:
    - wallet transactions / wallet signals
    - DEX activity (arbitrage / liquidity information)
    - developer activity (GitHub)
    - narrative signals

    Outputs:
    - RadarSignal rows persisted in the database, normalized into a common
      shape for use by radar UIs and higher-level engines.
    """

    def __init__(self) -> None:
        ...

    # ------------------------------------------------------------------
    # Wallet-based radar (wallet_accumulation)
    # ------------------------------------------------------------------
    def from_wallet_signals(
        self,
        db: Session,
        wallet_signals: List[WalletSignal],
    ) -> List[RadarSignal]:
        """
        Generate wallet_accumulation radar signals from wallet-follow signals.

        High-USD "large_buy", "accumulation_spike", and "whale_entry" events
        are surfaced as wallet_accumulation RadarSignal records.
        """
        if not wallet_signals:
            return []

        results: List[RadarSignal] = []

        for sig in wallet_signals:
            if sig.signal_type not in ("large_buy", "accumulation_spike", "whale_entry"):
                continue

            usd_value = float(sig.usd_value)
            # Normalize notional size into [0,1] with soft 0–1M band.
            size_strength = max(0.0, min(usd_value / 1_000_000.0, 1.0))
            confidence = float(sig.confidence)

            signal_strength = max(0.0, min(0.6 * size_strength + 0.4 * confidence, 1.0))

            radar = RadarSignal(
                signal_type="wallet_accumulation",
                token_symbol=sig.token_symbol,
                chain=None,
                signal_strength=signal_strength,
                confidence_score=confidence,
                source="WalletEngine",
                metadata_json={
                    "wallet_address": sig.wallet_address,
                    "usd_value": usd_value,
                    "raw_signal_type": sig.signal_type,
                },
            )
            db.add(radar)
            results.append(radar)

        if results:
            db.commit()

        return results

    # ------------------------------------------------------------------
    # DEX-based radar (dex_volume_spike / liquidity_increase)
    # ------------------------------------------------------------------
    def from_arbitrage_opportunities(
        self,
        db: Session,
        opportunities: List[Opportunity],
    ) -> List[RadarSignal]:
        """
        Generate dex_volume_spike / liquidity_increase radar signals from
        arbitrage-type opportunities.

        This treats high-score arbitrage opportunities with strong liquidity
        as indicative of on-chain activity worth surfacing in the radar.
        """
        if not opportunities:
            return []

        results: List[RadarSignal] = []

        for opp in opportunities:
            if opp.type != "arbitrage":
                continue

            liq = float(opp.liquidity_score or 0.0)
            total_score = float(opp.total_score or 0.0)

            # Use total_score and liquidity as a proxy for interesting DEX activity.
            dex_strength = max(0.0, min(total_score * 0.6 + liq * 0.4, 1.0))

            radar = RadarSignal(
                signal_type="dex_volume_spike",
                token_symbol=opp.asset_symbol or opp.base_symbol,
                chain=opp.chain,
                signal_strength=dex_strength,
                confidence_score=float(opp.confidence_score or 0.0),
                source="DexMonitor",
                metadata_json={
                    "opportunity_id": opp.id,
                    "estimated_roi_percent": opp.estimated_roi_percent,
                    "total_score": opp.total_score,
                    "liquidity_score": opp.liquidity_score,
                },
            )
            db.add(radar)
            results.append(radar)

            # Emit a separate liquidity_increase radar when liquidity is notably high.
            if liq >= 0.8:
                liq_radar = RadarSignal(
                    signal_type="liquidity_increase",
                    token_symbol=opp.asset_symbol or opp.base_symbol,
                    chain=opp.chain,
                    signal_strength=liq,
                    confidence_score=float(opp.confidence_score or 0.0),
                    source="DexMonitor",
                    metadata_json={
                        "opportunity_id": opp.id,
                        "liquidity_score": opp.liquidity_score,
                        "total_score": opp.total_score,
                    },
                )
                db.add(liq_radar)
                results.append(liq_radar)

        if results:
            db.commit()

        return results

    # ------------------------------------------------------------------
    # Developer-activity radar (dev_activity_spike)
    # ------------------------------------------------------------------
    def from_developer_activity(
        self,
        db: Session,
        activities: List[GitHubProjectActivityRaw],
    ) -> List[RadarSignal]:
        """
        Generate dev_activity_spike radar signals from GitHub activity snapshots.
        """
        if not activities:
            return []

        results: List[RadarSignal] = []

        for act in activities:
            commits_intensity = max(0.0, min(act.commits_7d / 100.0, 1.0))
            contrib_intensity = max(0.0, min(act.contributors_7d / 15.0, 1.0))
            stars_growth = max(0.0, min(act.stars_30d_delta / 2000.0, 1.0))

            strength = max(
                0.0,
                min(
                    0.5 * commits_intensity
                    + 0.3 * contrib_intensity
                    + 0.2 * stars_growth,
                    1.0,
                ),
            )

            radar = RadarSignal(
                signal_type="dev_activity_spike",
                token_symbol=None,
                chain=act.chain,
                signal_strength=strength,
                confidence_score=strength,
                source="GitHubActivity",
                metadata_json={
                    "project_name": act.project_name,
                    "repo_slug": act.repo_slug,
                    "stars_total": act.stars_total,
                    "stars_30d_delta": act.stars_30d_delta,
                    "commits_7d": act.commits_7d,
                    "contributors_7d": act.contributors_7d,
                    "tags": act.tags,
                },
            )
            db.add(radar)
            results.append(radar)

        if results:
            db.commit()

        return results

    # ------------------------------------------------------------------
    # Narrative radar (social_mentions_spike / wallet_accumulation proxy)
    # ------------------------------------------------------------------
    def from_narrative_signals(
        self,
        db: Session,
        narrative_signals: List[NarrativeSignal],
    ) -> List[RadarSignal]:
        """
        Generate radar signals from narrative_trend signals.

        - social_mentions_spike based on social_score and narrative_strength
        - wallet_accumulation proxy based on accumulation_score
        """
        if not narrative_signals:
            return []

        results: List[RadarSignal] = []

        for sig in narrative_signals:
            v = sig.value
            token = v["token_symbol"]

            social_score = float(v.get("social_score", 0.0) or 0.0)
            accumulation_score = float(v.get("accumulation_score", 0.0) or 0.0)
            narrative_strength = float(v.get("narrative_strength", 0.0) or 0.0)

            # Social mentions radar
            social_strength = max(
                0.0, min(0.6 * social_score + 0.4 * narrative_strength, 1.0)
            )
            if social_strength >= 0.4:
                radar_social = RadarSignal(
                    signal_type="social_mentions_spike",
                    token_symbol=token,
                    chain=None,
                    signal_strength=social_strength,
                    confidence_score=float(sig.confidence or 0.0),
                    source="NarrativeEngine",
                    metadata_json={
                        "narrative": v["narrative"],
                        "social_score": social_score,
                        "narrative_strength": narrative_strength,
                    },
                )
                db.add(radar_social)
                results.append(radar_social)

            # Wallet accumulation proxy radar
            if accumulation_score >= 0.4:
                radar_wallet = RadarSignal(
                    signal_type="wallet_accumulation",
                    token_symbol=token,
                    chain=None,
                    signal_strength=accumulation_score,
                    confidence_score=float(sig.confidence or 0.0),
                    source="NarrativeEngine",
                    metadata_json={
                        "narrative": v["narrative"],
                        "accumulation_score": accumulation_score,
                        "narrative_strength": narrative_strength,
                    },
                )
                db.add(radar_wallet)
                results.append(radar_wallet)

        if results:
            db.commit()

        return results

