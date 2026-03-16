from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Sequence

from pydantic import BaseModel

if TYPE_CHECKING:
    from app.services.signals.miner_signals import MinerSignal as ExtractedMinerSignal
    from app.services.signals.wallet_signals import WalletSignal as ExtractedWalletSignal
    from app.models.wallet_profile import WalletProfile
    from app.models.backtest_result import BacktestResult


class ScoreComponents(BaseModel):
    upside_score: float
    confidence_score: float
    freshness_score: float
    liquidity_score: float
    accessibility_score: float
    risk_score: float
    difficulty_score: float
    # How this opportunity type has performed historically in backtests.
    performance_score: float
    # Execution feasibility: liquidity depth, estimated slippage, trade size feasibility.
    execution_feasibility_score: float
    total_score: float


@dataclass
class ScoringContext:
    """
    Generic scoring context for an opportunity.

    All component scores should be provided in the range [0, 1] where applicable.
    Risk and difficulty are also treated as 0–1 scores where higher means worse.
    """

    upside_score: float
    confidence_score: float
    freshness_score: float
    liquidity_score: float
    accessibility_score: float
    risk_score: float
    difficulty_score: float
    # Optional performance component; 0.5 when no backtest history.
    performance_score: float = 0.5
    # Execution feasibility (liquidity depth, slippage, trade size); 0.5 when N/A.
    execution_feasibility_score: float = 0.5


class ScoringEngine:
    """
    Opportunity scoring engine.

    Computes normalized component scores and a final total_score using
    the provided weighted formula.

    total_score =
      upside_score * 0.25 +
      confidence_score * 0.20 +
      freshness_score * 0.15 +
      liquidity_score * 0.15 +
      accessibility_score * 0.10 +
      execution_feasibility_score * 0.05 -
      risk_score * 0.10 -
      difficulty_score * 0.05
    """

    def score(self, ctx: ScoringContext) -> ScoreComponents:
        # Clamp all inputs to [0, 1] for safety.
        up = self._clamp(ctx.upside_score)
        base_conf = self._clamp(ctx.confidence_score)
        fresh = self._clamp(ctx.freshness_score)
        liq = self._clamp(ctx.liquidity_score)
        acc = self._clamp(ctx.accessibility_score)
        risk = self._clamp(ctx.risk_score)
        diff = self._clamp(ctx.difficulty_score)
        perf = self._clamp(ctx.performance_score)
        exec_feas = self._clamp(ctx.execution_feasibility_score)

        # Enhance confidence scoring:
        # - start from base_conf (from upstream signal agreement / DEX reliability)
        # - penalize low liquidity
        # - reward fresher data slightly
        # Liquidity penalty: stronger penalty as liq approaches 0.
        liquidity_penalty = (1.0 - liq) * 0.4  # up to -40% when liq == 0
        # Freshness boost: small uplift for very fresh data.
        freshness_boost = (fresh - 0.5) * 0.2  # in [-0.1, +0.1] when fresh in [0,1]

        adjusted_conf = base_conf * (1.0 - liquidity_penalty)
        adjusted_conf = self._clamp(adjusted_conf + freshness_boost)

        # Freshness boost: very fresh opportunities get a small upside bump.
        freshness_factor = 1.0 + (fresh - 0.5) * 0.2  # ±10%

        # Market-cap adjustment: treat low-liquidity (small-cap proxy) as having
        # slightly higher upside weighting.
        small_cap_boost = 1.0
        if liq < 0.3:
            small_cap_boost += (0.3 - liq) * 0.3  # up to ~9% extra when liq ≈ 0

        # Rare opportunity boost: exceptionally strong upside with acceptable risk.
        rarity_boost = 1.0
        if up >= 0.9 and risk <= 0.6:
            rarity_boost += 0.05

        up_effective = self._clamp(up * freshness_factor * small_cap_boost * rarity_boost)

        # Confidence scaling: heavily discount very low-confidence ideas and give
        # a slight boost to very high-confidence ones.
        conf_scale = 1.0
        if adjusted_conf < 0.4:
            conf_scale = 0.6 + adjusted_conf * 0.5  # ~0.6–0.8
        elif adjusted_conf > 0.8:
            conf_scale = 1.0 + (adjusted_conf - 0.8) * 0.25  # up to +5%

        total = (
            up_effective * 0.25
            + adjusted_conf * 0.20 * conf_scale
            + fresh * 0.15
            + liq * 0.15
            + acc * 0.10
            + perf * 0.10
            + exec_feas * 0.05
            - risk * 0.10
            - diff * 0.05
        )

        return ScoreComponents(
            upside_score=up_effective,
            confidence_score=adjusted_conf,
            freshness_score=fresh,
            liquidity_score=liq,
            accessibility_score=acc,
            risk_score=risk,
            difficulty_score=diff,
            performance_score=perf,
            execution_feasibility_score=exec_feas,
            total_score=total,
        )

    def score_miner(self, signal: "ExtractedMinerSignal") -> ScoreComponents:
        """
        Miner ROI–specific scoring that maps raw ROI economics into the shared
        component model, then uses the common total_score formula.

        Prioritizes:
        - shorter ROI (payback months)
        - higher monthly yield (net profit)
        - lower hardware cost
        - higher effective token liquidity (approximated via network difficulty)
        """
        v = signal.value

        roi_months = float(v["roi_months"])
        roi_percent = float(v["roi_percent"])
        net_monthly_profit = float(v["net_monthly_profit"])
        hardware_cost = float(v["hardware_cost"])
        power_draw = float(v["power_draw_watts"])
        network_difficulty = float(v["network_difficulty"])

        # Upside: combine speed of payback and annualized ROI.
        roi_speed = self._clamp((18.0 - roi_months) / 18.0)
        yield_ratio = self._clamp(max(0.0, roi_percent) / 200.0)
        upside_score = self._clamp(roi_speed * 0.6 + yield_ratio * 0.4)

        confidence_score = self._clamp(float(signal.confidence))

        # Miner signals are derived from slow-moving economics; treat as reasonably fresh.
        freshness_score = 0.8

        # Liquidity proxy: more established networks (higher difficulty) assumed to have
        # deeper liquidity.
        if network_difficulty >= 1.8:
            liquidity_score = 0.9
        elif network_difficulty >= 1.2:
            liquidity_score = 0.75
        else:
            liquidity_score = 0.6

        # Accessibility: hardware + operational burden means miners are less accessible
        # than pure on-chain arbitrage.
        accessibility_score = 0.7

        # Risk: longer payback and higher capex both increase risk.
        if roi_months <= 9:
            base_risk = 0.3
        elif roi_months <= 14:
            base_risk = 0.45
        else:
            base_risk = 0.6

        if hardware_cost > 15000:
            base_risk += 0.15
        elif hardware_cost > 8000:
            base_risk += 0.05

        risk_score = self._clamp(base_risk)

        # Difficulty: more expensive and power-hungry setups are harder to execute.
        if hardware_cost <= 5000 and power_draw <= 1500:
            difficulty_score = 0.25
        elif hardware_cost <= 12000 and power_draw <= 2500:
            difficulty_score = 0.5
        else:
            difficulty_score = 0.8

        ctx = ScoringContext(
            upside_score=upside_score,
            confidence_score=confidence_score,
            freshness_score=freshness_score,
            liquidity_score=liquidity_score,
            accessibility_score=accessibility_score,
            risk_score=risk_score,
            difficulty_score=difficulty_score,
        )

        return self.score(ctx)

    def score_wallet(
        self,
        signal: "ExtractedWalletSignal",
        profile: "WalletProfile | None" = None,
    ) -> ScoreComponents:
        """
        Wallet-follow specific scoring.

        Prioritizes:
        - transaction size (usd_value)
        - wallet historical profitability (proxied via confidence)
        - recency of the event
        - token liquidity (blue-chips vs long tail)
        """
        usd_value = float(signal.usd_value)
        token = signal.token_symbol
        event_time = signal.timestamp

        # Upside: larger notional trades from smart wallets → higher upside.
        # Scale size score with soft saturation.
        size_score = self._clamp(usd_value / 500_000.0)  # 500k+ treated as max size

        # Historical profitability proxy: use provided confidence directly,
        # optionally adjusted by a stored WalletProfile if available.
        prof_score = self._clamp(float(signal.confidence))

        upside_score = self._clamp(size_score * 0.65 + prof_score * 0.35)

        # Base confidence is dominated by the wallet's track record (already encoded).
        confidence_score = prof_score

        # Recency / freshness: 0–60 minutes → 1 → decay after.
        now = datetime.now(event_time.tzinfo or None)
        age_minutes = max(
            0.0, (now - event_time).total_seconds() / 60.0 if isinstance(event_time, datetime) else 0.0
        )
        if age_minutes <= 15:
            freshness_score = 1.0
        elif age_minutes <= 60:
            freshness_score = self._clamp(1.0 - (age_minutes - 15) / 45.0)
        else:
            freshness_score = 0.4

        # Token liquidity: simple heuristic based on token class.
        blue_chips = {"BTC", "ETH", "SOL"}
        majors = {"JTO", "RNDR", "FIL"}
        if token in blue_chips:
            liquidity_score = 0.95
        elif token in majors:
            liquidity_score = 0.85
        else:
            liquidity_score = 0.7

        # Accessibility: following smart wallets on majors is relatively easy.
        accessibility_score = 0.8 if token in blue_chips | majors else 0.7

        # Risk: very large trades in illiquid tokens are riskier.
        if token in blue_chips:
            base_risk = 0.35
        elif token in majors:
            base_risk = 0.45
        else:
            base_risk = 0.6

        if usd_value >= 500_000:
            base_risk += 0.1
        elif usd_value >= 150_000:
            base_risk += 0.05

        risk_score = self._clamp(base_risk)

        # If we have a WalletProfile, adjust confidence and risk using
        # historical success and realized performance.
        if profile is not None:
            success = self._clamp(profile.historical_success_rate)
            roi_factor = self._clamp(profile.avg_roi_percent / 100.0)
            perf_factor = self._clamp(
                0.5 + profile.avg_token_performance_percent / 200.0
            )  # center around 0.5

            profile_quality = (
                success * 0.5
                + roi_factor * 0.3
                + perf_factor * 0.2
            )

            confidence_score = self._clamp(
                confidence_score * (0.6 + profile_quality * 0.4)
            )

            # Reduce perceived risk for consistently strong performers, increase
            # it for poor performers.
            risk_adjustment = (0.5 - profile_quality) * 0.3  # in [-0.15, +0.15]
            risk_score = self._clamp(risk_score + risk_adjustment)

        # Difficulty: executing a similar-sized follow trade on majors is easier.
        if token in blue_chips and usd_value <= 200_000:
            difficulty_score = 0.3
        elif usd_value <= 500_000:
            difficulty_score = 0.5
        else:
            difficulty_score = 0.75

        ctx = ScoringContext(
            upside_score=upside_score,
            confidence_score=confidence_score,
            freshness_score=freshness_score,
            liquidity_score=liquidity_score,
            accessibility_score=accessibility_score,
            risk_score=risk_score,
            difficulty_score=difficulty_score,
        )

        return self.score(ctx)

    # ------------------------------------------------------------------
    # Historical performance integration (BacktestResult)
    # ------------------------------------------------------------------
    def compute_performance_score(
        self,
        backtests: "Sequence[BacktestResult] | None",
    ) -> float:
        """
        Compute a normalized performance_score in [0, 1] from historical
        BacktestResult rows.

        Intuition:
        - Higher historical success rates (success_flag True more often)
          should boost the score.
        - Positive average 24h ROI should further increase confidence,
          while consistently negative ROI should reduce it.

        The returned value is designed so that:
        - ~0.5 is neutral / unknown.
        - >0.5 favours opportunity types with strong realized performance.
        - <0.5 penalizes consistently poor performance.
        """
        if not backtests:
            return 0.5

        completed = [b for b in backtests if b.success_flag is not None]
        if not completed:
            return 0.5

        total = len(completed)
        successes = sum(1 for b in completed if b.success_flag)
        success_rate = successes / total if total > 0 else 0.0  # in [0, 1]

        # Use 24h ROI as the primary performance horizon; fall back to 7d
        # if 24h is missing, and ignore None values.
        rois: list[float] = []
        for b in completed:
            if b.roi_24h_percent is not None:
                rois.append(float(b.roi_24h_percent))
            elif b.roi_7d_percent is not None:
                rois.append(float(b.roi_7d_percent))

        avg_roi = sum(rois) / len(rois) if rois else 0.0

        # Normalize average ROI into a conservative band:
        # -50% → 0.0, 0% → 0.5, +100% → 1.0 (clamped outside this range).
        roi_norm = max(-50.0, min(avg_roi, 100.0))
        roi_component = (roi_norm + 50.0) / 150.0

        # Blend success rate and ROI into a single performance_score.
        perf = success_rate * 0.7 + roi_component * 0.3
        return self._clamp(perf)

    def apply_backtest_performance(
        self,
        base: ScoreComponents,
        backtests: "Sequence[BacktestResult] | None",
    ) -> ScoreComponents:
        """
        Given pre-computed component scores and historical BacktestResults,
        return a new ScoreComponents object with:

        - performance_score populated from backtest history
        - total_score adjusted slightly up or down based on performance

        This lets pipelines re-score opportunities after enough historical
        data exists, without changing the original component math.
        """
        perf = self.compute_performance_score(backtests)

        # Adjust total_score with a mild multiplier so that performance
        # meaningfully influences ranking without dominating it.
        # perf in [0,1] → multiplier in [0.9, 1.1]
        multiplier = 0.9 + perf * 0.2

        return base.copy(
            update={
                "performance_score": perf,
                "total_score": base.total_score * multiplier,
            }
        )

    @staticmethod
    def _clamp(value: float) -> float:
        return max(0.0, min(1.0, value))

