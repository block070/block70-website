from datetime import datetime, timezone

from app.schemas.opportunity import OpportunityCreate, OpportunityScores
from app.schemas.opportunity_db import OpportunityCreate as DbOpportunityCreate
from app.schemas.signals import ArbitrageSignal, MinerSignal, WalletSignal
from app.services.pipeline.expiration import compute_expires_at
from app.services.signals.arbitrage_signals import (
    ArbitrageSignal as ExtractedArbitrageSignal,
)
from app.services.signals.miner_signals import (
    MinerSignal as ExtractedMinerSignal,
)
from app.services.signals.wallet_signals import (
    WalletSignal as ExtractedWalletSignal,
)
from app.services.signals.narrative_signals import (
    NarrativeSignal as ExtractedNarrativeSignal,
)
from app.services.connectors.airdrop_connector import AirdropOpportunityRaw
from app.services.connectors.github_connector import GitHubProjectActivityRaw
from app.models import CandidateProject


class OpportunityNormalizer:
    """
    Converts typed signals into normalized Opportunity objects.

    This service has two layers:
    - normalization for the high-level Opportunity Engine (arbitrage/miner/wallet)
    - normalization from the lower-level arbitrage signal extractor into
      the database-oriented Opportunity schema.
    """

    def normalize_arbitrage(
        self,
        signal: ArbitrageSignal,
        scores: OpportunityScores,
    ) -> OpportunityCreate:
        detected_at = signal.detected_at.astimezone(timezone.utc)
        expires_at = compute_expires_at("arbitrage", detected_at)
        now = datetime.now(timezone.utc)

        title = f"{signal.pair} arbitrage on {signal.chain}"
        description = (
            f"Spread of {signal.spread_pct * 100:.2f}% between "
            f"{signal.dex_buy} (buy) and {signal.dex_sell} (sell) on {signal.chain}."
        )

        return OpportunityCreate(
            type="arbitrage",
            title=title,
            description=description,
            source="Arbitrage Scanner",
            dedup_key=signal.dedup_key,
            scores=scores,
            detected_at=detected_at,
            last_seen_at=now,
            expires_at=expires_at,
            status="active",
            raw_payload={
                "pair": signal.pair,
                "chain": signal.chain,
                "dex_buy": signal.dex_buy,
                "dex_sell": signal.dex_sell,
                "spread_pct": signal.spread_pct,
                "volume_usd": signal.volume_usd,
                "latency_ms": signal.latency_ms,
                "external_id": signal.external_id,
            },
        )

    def normalize_mining(
        self,
        signal: MinerSignal,
        scores: OpportunityScores,
    ) -> OpportunityCreate:
        detected_at = signal.detected_at.astimezone(timezone.utc)
        expires_at = compute_expires_at("mining", detected_at)
        now = datetime.now(timezone.utc)

        title = f"{signal.hardware_model} {signal.token_symbol} miner ROI"
        description = (
            f"{signal.hardware_model} mining {signal.token_symbol} with "
            f"~${signal.daily_profit_usd:.2f} daily profit, "
            f"{signal.roi_percent_per_year:.1f}% est. annual ROI "
            f"and ~{signal.payback_days:.0f} day payback period."
        )

        return OpportunityCreate(
            type="mining",
            title=title,
            description=description,
            source="Miner ROI Agent",
            dedup_key=signal.dedup_key,
            scores=scores,
            detected_at=detected_at,
            last_seen_at=now,
            expires_at=expires_at,
            status="active",
            raw_payload={
                "hardware_model": signal.hardware_model,
                "algorithm": signal.algorithm,
                "token_symbol": signal.token_symbol,
                "hash_rate_th": signal.hash_rate_th,
                "power_w": signal.power_w,
                "electricity_cost_usd_per_kwh": signal.electricity_cost_usd_per_kwh,
                "hardware_cost_usd": signal.hardware_cost_usd,
                "revenue_usd_per_day": signal.revenue_usd_per_day,
                "daily_profit_usd": signal.daily_profit_usd,
                "roi_percent_per_year": signal.roi_percent_per_year,
                "payback_days": signal.payback_days,
                "external_id": signal.external_id,
            },
        )

    def normalize_wallet(
        self,
        signal: WalletSignal,
        scores: OpportunityScores,
    ) -> OpportunityCreate:
        detected_at = signal.detected_at.astimezone(timezone.utc)
        expires_at = compute_expires_at("wallet", detected_at)
        now = datetime.now(timezone.utc)

        title = f"Smart wallet {signal.action} {signal.token_symbol}"
        description = (
            f"Wallet {signal.wallet_address[:8]}… on {signal.chain} executed a "
            f"{signal.action} of ~${signal.amount_usd:,.0f} in {signal.token_symbol}. "
            f"30d realized PnL {signal.realized_pnl_30d_pct:.1f}% with "
            f"{signal.win_rate_30d * 100:.1f}% win rate over "
            f"{signal.realized_trades_30d} trades."
        )

        return OpportunityCreate(
            type="wallet",
            title=title,
            description=description,
            source="Wallet Tracker",
            dedup_key=signal.dedup_key,
            scores=scores,
            detected_at=detected_at,
            last_seen_at=now,
            expires_at=expires_at,
            status="active",
            raw_payload={
                "wallet_address": signal.wallet_address,
                "chain": signal.chain,
                "token_symbol": signal.token_symbol,
                "action": signal.action,
                "amount_usd": signal.amount_usd,
                "realized_pnl_30d_pct": signal.realized_pnl_30d_pct,
                "realized_trades_30d": signal.realized_trades_30d,
                "win_rate_30d": signal.win_rate_30d,
                "tx_hash": signal.tx_hash,
                "conviction_score": signal.conviction_score,
                "external_id": signal.external_id,
            },
        )

    # ------------------------------------------------------------------
    # DB-oriented normalization: arbitrage / miner signals → OpportunityCreate
    # ------------------------------------------------------------------

    def normalize_arbitrage_db(
        self,
        signal: ExtractedArbitrageSignal,
    ) -> DbOpportunityCreate:
        """
        Convert a low-level arbitrage signal into an OpportunityCreate suitable
        for persistence via the DB-oriented Opportunity model.

        Fields generated:
        - title
        - summary
        - estimated_roi_percent
        - risk_level
        - difficulty_level
        - confidence_score
        and all other required Opportunity fields.
        """
        v = signal.value
        pair = v["pair"]
        buy_dex = v["buy_dex"]
        sell_dex = v["sell_dex"]
        spread_percent = float(v["spread_percent"])
        fees_percent = float(v["estimated_fees_percent"])
        liquidity_score = float(v["liquidity_score"])

        # Basic derived ROI estimate (net of fees)
        net_edge_percent = max(spread_percent - fees_percent, 0.0)

        title = f"{pair} arbitrage: buy on {buy_dex}, sell on {sell_dex}"
        summary = (
            f"Detected {spread_percent:.2f}% spread on {pair} between {buy_dex} (buy) "
            f"and {sell_dex} (sell), with ~{fees_percent:.2f}% estimated fees and "
            f"{liquidity_score:.2f} liquidity score."
        )

        confidence_score = float(signal.confidence)

        # Risk and difficulty levels based on edge and liquidity.
        if net_edge_percent <= 0.5:
            risk_level = "high"
        elif net_edge_percent <= 1.5:
            risk_level = "medium"
        else:
            risk_level = "low"

        if liquidity_score >= 0.8:
            difficulty_level = "easy"
        elif liquidity_score >= 0.4:
            difficulty_level = "medium"
        else:
            difficulty_level = "hard"

        # Normalize total_score as a simple blend.
        upside_score = min(max(net_edge_percent / 5.0, 0.0), 1.0)  # net 5%+ → 1.0
        freshness_score = 1.0  # mock data is assumed fresh at extraction time
        accessibility_score = 0.9  # Jupiter/Raydium/Orca assumed accessible
        risk_score = 1.0 - min(confidence_score, 1.0)
        difficulty_score = 0.3 if difficulty_level == "easy" else (
            0.6 if difficulty_level == "medium" else 0.8
        )

        total_score = (
            upside_score * 0.4
            + confidence_score * 0.25
            + freshness_score * 0.15
            + liquidity_score * 0.1
            + accessibility_score * 0.1
        )

        now = datetime.now(timezone.utc)

        return DbOpportunityCreate(
            title=title,
            slug=f"arbitrage-{pair.replace('/', '-').lower()}-{buy_dex.lower()}-{sell_dex.lower()}",
            type="arbitrage",
            chain=None,
            status="active",
            summary=summary,
            thesis=None,
            asset_symbol=pair.split("/")[0],
            base_symbol=pair.split("/")[0],
            quote_symbol=pair.split("/")[1],
            source="Arbitrage Scanner",
            source_ref=signal.entity_id,
            estimated_cost=None,
            estimated_upside=net_edge_percent,
            estimated_roi_percent=net_edge_percent,
            confidence_score=confidence_score,
            upside_score=upside_score,
            freshness_score=freshness_score,
            liquidity_score=liquidity_score,
            accessibility_score=accessibility_score,
            risk_score=risk_score,
            difficulty_score=difficulty_score,
            total_score=total_score,
            risk_level=risk_level,
            difficulty_level=difficulty_level,
            detected_at=signal.timestamp,
            expires_at=None,
            last_seen_at=now,
        )

    def normalize_mining_db(
        self,
        signal: ExtractedMinerSignal,
    ) -> DbOpportunityCreate:
        """
        Convert a miner ROI signal into an OpportunityCreate suitable for the
        shared DB-backed Opportunity model.

        Fields explicitly populated:
        - title
        - summary
        - asset_symbol
        - estimated_cost
        - estimated_upside (net monthly profit in USD)
        - estimated_roi_percent (annualized percentage)
        - difficulty_level
        - risk_level
        - confidence_score
        """
        v = signal.value

        project_name = v["project_name"]
        token_symbol = v["token_symbol"]
        hardware_name = v["hardware_name"]

        hardware_cost = float(v["hardware_cost"])
        net_monthly_profit = float(v["net_monthly_profit"])
        roi_months = float(v["roi_months"])
        roi_percent = float(v["roi_percent"])

        title = f"{project_name}: {hardware_name} {token_symbol} miner ROI"
        summary = (
            f"{hardware_name} mining {token_symbol} for {project_name} with "
            f"~${net_monthly_profit:,.0f} net monthly profit and "
            f"~{roi_months:.1f} month payback (~{roi_percent:.1f}% annualized ROI)."
        )

        confidence_score = float(signal.confidence)

        # Human-readable difficulty based on capex and power draw.
        power_draw = float(v["power_draw_watts"])
        if hardware_cost <= 6000 and power_draw <= 1500:
            difficulty_level = "easy"
        elif hardware_cost <= 12000 and power_draw <= 2500:
            difficulty_level = "medium"
        else:
            difficulty_level = "hard"

        # Risk level based on payback duration.
        if roi_months <= 9:
            risk_level = "low"
        elif roi_months <= 14:
            risk_level = "medium"
        else:
            risk_level = "high"

        now = datetime.now(timezone.utc)

        return DbOpportunityCreate(
            title=title,
            slug=f"mining-{project_name.lower().replace(' ', '-')}-{hardware_name.lower().replace(' ', '-')}",
            type="mining",
            chain=None,
            status="active",
            summary=summary,
            thesis=None,
            asset_symbol=token_symbol,
            base_symbol=token_symbol,
            quote_symbol=None,
            source="Miner ROI Agent",
            source_ref=signal.value.get("external_id") if isinstance(signal.value, dict) else None,
            estimated_cost=hardware_cost,
            estimated_upside=net_monthly_profit,
            estimated_roi_percent=roi_percent,
            confidence_score=confidence_score,
            risk_level=risk_level,
            difficulty_level=difficulty_level,
            detected_at=signal.timestamp,
            expires_at=None,
            last_seen_at=now,
        )

    def normalize_wallet_db(
        self,
        signal: ExtractedWalletSignal,
    ) -> DbOpportunityCreate:
        """
        Convert a wallet-follow signal into an OpportunityCreate suitable for the
        shared DB-backed Opportunity model.

        Fields explicitly populated:
        - title
        - summary
        - asset_symbol
        - estimated_upside (proxy: notional USD value of the move)
        - confidence_score
        - risk_level
        - difficulty_level
        """
        wallet = signal.wallet_address
        token = signal.token_symbol
        usd_value = float(signal.usd_value)
        signal_type = signal.signal_type

        # Title tuned for accumulation / entries, but still sensible for sells.
        if signal_type in ("large_buy", "accumulation_spike", "whale_entry"):
            title = f"Smart wallet accumulation detected for {token}"
        elif signal_type == "large_sell":
            title = f"Smart wallet de-risking on {token}"
        else:
            title = f"Smart wallet activity on {token}"

        short_wallet = f"{wallet[:6]}…{wallet[-4:]}" if len(wallet) > 10 else wallet

        summary = (
            f"Wallet {short_wallet} executed a {signal_type.replace('_', ' ')} "
            f"of ~${usd_value:,.0f} in {token}. "
            f"Event sourced from high-performing wallet activity."
        )

        confidence_score = float(signal.confidence)

        # Risk level: very large, aggressive entries are higher risk, moderate entries lower.
        if signal_type == "large_sell":
            risk_level = "medium"
        elif usd_value >= 500_000:
            risk_level = "high"
        elif usd_value >= 150_000:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Difficulty level: executing follow trades on majors is "easy", others "medium".
        blue_chips = {"BTC", "ETH", "SOL"}
        if token in blue_chips:
            difficulty_level = "easy"
        else:
            difficulty_level = "medium"

        now = datetime.now(timezone.utc)

        return DbOpportunityCreate(
            title=title,
            slug=f"wallet-{token.lower()}-{short_wallet.lower()}",
            type="wallet",
            chain=None,
            status="active",
            summary=summary,
            thesis=None,
            asset_symbol=token,
            base_symbol=token,
            quote_symbol=None,
            source="Wallet Tracker",
            source_ref=None,
            estimated_cost=None,
            estimated_upside=usd_value,
            estimated_roi_percent=None,
            confidence_score=confidence_score,
            risk_level=risk_level,
            difficulty_level=difficulty_level,
            detected_at=signal.timestamp,
            expires_at=None,
            last_seen_at=now,
        )

    def normalize_narrative_db(
        self,
        signal: ExtractedNarrativeSignal,
    ) -> DbOpportunityCreate:
        """
        Convert a narrative trend signal into an OpportunityCreate suitable for the
        shared DB-backed Opportunity model.

        This treats narratives as a meta-opportunity that can sit alongside
        arbitrage / miner / wallet entries in the feed.

        Fields explicitly populated:
        - title
        - summary
        - asset_symbol (anchor token for the narrative, if any)
        - estimated_upside (proxy derived from narrative strength)
        - confidence_score
        - freshness_score
        - risk_level
        """
        v = signal.value

        token = v["token_symbol"]
        narrative = v["narrative"]
        narrative_strength = float(v["narrative_strength"])
        social_score = float(v["social_score"])
        accumulation_score = float(v["accumulation_score"])
        momentum_score = float(v["momentum_score"])

        title = f"{narrative} narrative gaining traction"

        summary = (
            f"{narrative} narrative is strengthening across {token}: "
            f"social, wallet accumulation, and price momentum are all above "
            f"baseline, with composite narrative strength "
            f"{narrative_strength:.2f}."
        )

        # Use the signal's confidence directly; narrative_strength serves as a
        # proxy for upside / potential.
        confidence_score = float(signal.confidence)
        freshness_score = 1.0  # narrative signals are assumed near real-time

        # Map narrative strength into a soft upside proxy (0–100%).
        estimated_upside = max(0.0, min(narrative_strength * 100.0, 200.0))

        # Risk: hot narratives with extreme momentum are riskier.
        if momentum_score >= 0.8 and accumulation_score >= 0.8:
            risk_level = "high"
        elif momentum_score >= 0.5:
            risk_level = "medium"
        else:
            risk_level = "low"

        now = datetime.now(timezone.utc)

        return DbOpportunityCreate(
            title=title,
            slug=f"narrative-{narrative.lower().replace(' ', '-')}-{token.lower()}",
            type="narrative",
            chain=None,
            status="active",
            summary=summary,
            thesis=None,
            asset_symbol=token,
            base_symbol=token,
            quote_symbol=None,
            source="Narrative Engine",
            source_ref=None,
            estimated_cost=None,
            estimated_upside=estimated_upside,
            estimated_roi_percent=None,
            confidence_score=confidence_score,
            freshness_score=freshness_score,
            risk_level=risk_level,
            difficulty_level=None,
            detected_at=signal.timestamp,
            expires_at=None,
            last_seen_at=now,
        )

    def normalize_airdrop_db(
        self,
        raw: AirdropOpportunityRaw,
    ) -> DbOpportunityCreate:
        """
        Convert a raw airdrop discovery record into an OpportunityCreate suitable
        for the shared DB-backed Opportunity model.

        Fields explicitly populated:
        - title
        - summary
        - estimated_upside (proxy: estimated airdrop value in USD)
        - difficulty_level
        - confidence_score
        """
        title = f"{raw.project_name} airdrop candidate"

        summary = (
            f"Candidate airdrop on {raw.chain} for {raw.project_name} with an "
            f"estimated value of ~${raw.estimated_value_usd:,.0f}. "
            f"Difficulty: {raw.difficulty}. Tasks: {raw.tasks_required}"
        )

        # Simple heuristic: lower operational difficulty → slightly higher confidence.
        difficulty = (raw.difficulty or "").lower()
        if difficulty == "low":
            confidence_score = 0.8
        elif difficulty == "medium":
            confidence_score = 0.7
        elif difficulty == "high":
            confidence_score = 0.6
        else:
            confidence_score = 0.65

        difficulty_level = raw.difficulty.lower() if raw.difficulty else None

        # Rough risk level – higher effort and complexity imply higher risk
        # that users fail to capture the full airdrop.
        if difficulty_level == "high":
            risk_level = "high"
        elif difficulty_level == "medium":
            risk_level = "medium"
        else:
            risk_level = "low"

        now = datetime.now(timezone.utc)

        return DbOpportunityCreate(
            title=title,
            slug=f"airdrop-{raw.project_name.lower().replace(' ', '-')}",
            type="airdrop",
            chain=raw.chain,
            status="active",
            summary=summary,
            thesis=None,
            asset_symbol=None,
            base_symbol=None,
            quote_symbol=None,
            source="Airdrop Discovery Engine",
            source_ref=None,
            estimated_cost=None,
            estimated_upside=raw.estimated_value_usd,
            estimated_roi_percent=None,
            confidence_score=confidence_score,
            risk_level=risk_level,
            difficulty_level=difficulty_level,
            detected_at=raw.detected_at,
            expires_at=None,
            last_seen_at=now,
        )

    def normalize_developer_activity_db(
        self,
        raw: GitHubProjectActivityRaw,
    ) -> DbOpportunityCreate:
        """
        Convert a GitHubProjectActivityRaw record into an OpportunityCreate
        suitable for the shared DB-backed Opportunity model.

        This surfaces "builder" / dev-activity-driven opportunities such as
        new DePIN or infra projects gaining traction.
        """
        project = raw.project_name
        chain = raw.chain
        age_days = max(
            0.0,
            (raw.detected_at - raw.first_commit_at).total_seconds() / 86400.0,
        )
        hours_since_last_commit = max(
            0.0,
            (raw.detected_at - raw.last_commit_at).total_seconds() / 3600.0,
        )

        # Title and summary
        title = f"{project} gaining developer traction"

        summary = (
            f"{project} shows strong recent GitHub activity with "
            f"{raw.commits_7d} commits and {raw.contributors_7d} contributors "
            f"in the last 7 days, and {raw.stars_30d_delta} new stars over the "
            f"last 30 days (total {raw.stars_total})."
        )

        # Freshness: highest when the project is relatively new and commits are recent.
        if age_days <= 90:
            age_freshness = 1.0
        elif age_days <= 365:
            age_freshness = max(0.4, 1.0 - (age_days - 90) / 365.0)
        else:
            age_freshness = 0.4

        if hours_since_last_commit <= 24:
            commit_freshness = 1.0
        elif hours_since_last_commit <= 72:
            commit_freshness = 0.7
        else:
            commit_freshness = 0.4

        freshness_score = max(0.0, min((age_freshness * 0.5 + commit_freshness * 0.5), 1.0))

        # Confidence based on commit volume and contributor breadth.
        commit_intensity = max(0.0, min(raw.commits_7d / 100.0, 1.0))
        contributor_intensity = max(0.0, min(raw.contributors_7d / 15.0, 1.0))
        stars_growth = max(0.0, min(raw.stars_30d_delta / 2000.0, 1.0))

        confidence_score = max(
            0.0,
            min(
                0.4 * commit_intensity
                + 0.3 * contributor_intensity
                + 0.3 * stars_growth,
                1.0,
            ),
        )

        # Difficulty: following dev activity is relatively easy; actual execution
        # (running infra, participating in testnets) may vary by project.
        if "indexer" in raw.tags or "infra" in raw.tags:
            difficulty_level = "medium"
        else:
            difficulty_level = "easy"

        # Risk: early, fast-moving projects are higher risk.
        if age_days <= 60 and stars_growth >= 0.7:
            risk_level = "high"
        elif stars_growth >= 0.4:
            risk_level = "medium"
        else:
            risk_level = "low"

        now = datetime.now(timezone.utc)

        return DbOpportunityCreate(
            title=title,
            slug=f"dev-{project.lower().replace(' ', '-')}",
            type="developer",
            chain=chain,
            status="active",
            summary=summary,
            thesis=None,
            asset_symbol=None,
            base_symbol=None,
            quote_symbol=None,
            source="GitHub Activity Engine",
            source_ref=raw.repo_slug,
            estimated_cost=None,
            estimated_upside=None,
            estimated_roi_percent=None,
            confidence_score=confidence_score,
            freshness_score=freshness_score,
            risk_level=risk_level,
            difficulty_level=difficulty_level,
            detected_at=raw.detected_at,
            expires_at=None,
            last_seen_at=now,
        )

    def normalize_candidate_project_db(
        self,
        raw: CandidateProject,
    ) -> DbOpportunityCreate:
        """
        Convert a high-scoring CandidateProject into a project_discovery
        Opportunity suitable for the shared DB-backed Opportunity model.

        Fields explicitly populated:
        - title
        - summary
        - confidence_score
        - freshness_score
        - risk_level
        - difficulty_level
        """
        project_name = raw.project_name
        token_symbol = raw.token_symbol

        title = f"{project_name} project discovery"

        summary_parts: list[str] = [f"Candidate project {project_name} detected via the Opportunity Hunter."]
        if token_symbol:
            summary_parts.append(f"Token: {token_symbol}.")
        if raw.dev_activity_score:
            summary_parts.append(
                f"Developer activity score ~{float(raw.dev_activity_score) * 100:.0f}%."
            )
        if raw.social_activity_score:
            summary_parts.append(
                f"Social activity score ~{float(raw.social_activity_score) * 100:.0f}%."
            )
        if raw.description:
            summary_parts.append(raw.description)

        summary = " ".join(summary_parts)

        confidence_score = max(
            0.0, min(float(raw.confidence_score or 0.0), 1.0)
        )

        # Freshness based on detection time when available.
        detected_at = raw.detected_at or datetime.now(timezone.utc)
        age_hours = max(
            0.0,
            (datetime.now(timezone.utc) - detected_at).total_seconds() / 3600.0,
        )
        if age_hours <= 6:
            freshness_score = 1.0
        elif age_hours <= 24:
            freshness_score = max(0.5, 1.0 - (age_hours - 6) / 36.0)
        else:
            freshness_score = 0.4

        # Risk level based on confidence and age: low-confidence or very fresh
        # projects are higher risk.
        if confidence_score >= 0.75 and age_hours > 24:
            risk_level = "low"
        elif confidence_score >= 0.5:
            risk_level = "medium"
        else:
            risk_level = "high"

        # Difficulty: following EVM / major-chain projects is easier than
        # more exotic chains or unspecified environments.
        major_chains = {"ethereum", "solana", "bitcoin", "polygon", "bsc"}
        chain = (raw.chain or "").lower() if raw.chain else None
        if chain and chain in major_chains:
            difficulty_level = "easy"
        elif chain:
            difficulty_level = "medium"
        else:
            difficulty_level = "medium"

        now = datetime.now(timezone.utc)

        return DbOpportunityCreate(
            title=title,
            slug=f"project-discovery-{project_name.lower().replace(' ', '-')}",
            type="project_discovery",
            chain=raw.chain,
            status="active",
            summary=summary,
            thesis=None,
            asset_symbol=token_symbol,
            base_symbol=token_symbol,
            quote_symbol=None,
            source=raw.source or "Opportunity Hunter",
            source_ref=raw.source_url,
            estimated_cost=None,
            estimated_upside=None,
            estimated_roi_percent=None,
            confidence_score=confidence_score,
            freshness_score=freshness_score,
            # For project_discovery opportunities we treat the upstream
            # activity/confidence signal as the primary total_score so that
            # generic alerts using min_score can fire on high-quality
            # candidate projects.
            total_score=confidence_score,
            risk_level=risk_level,
            difficulty_level=difficulty_level,
            detected_at=detected_at,
            expires_at=None,
            last_seen_at=now,
        )

