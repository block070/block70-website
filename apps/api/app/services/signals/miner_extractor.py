from typing import List

from app.schemas.signals import MinerRaw, MinerSignal


class MinerSignalExtractor:
    """
    Converts raw miner ROI data into typed signals with derived ROI metrics.
    """

    def extract(self, source: str, raw_items: List[MinerRaw]) -> List[MinerSignal]:
        signals: List[MinerSignal] = []
        for raw in raw_items:
            # Rough cost per day from power consumption
            daily_kwh = raw.power_w * 24 / 1000
            power_cost_per_day = daily_kwh * raw.electricity_cost_usd_per_kwh
            daily_profit_usd = raw.revenue_usd_per_day - power_cost_per_day

            # Basic ROI metrics
            if raw.hardware_cost_usd > 0:
                roi_percent_per_year = (daily_profit_usd * 365 / raw.hardware_cost_usd) * 100
                payback_days = (
                    raw.hardware_cost_usd / daily_profit_usd if daily_profit_usd > 0 else float("inf")
                )
            else:
                roi_percent_per_year = 0.0
                payback_days = float("inf")

            dedup_key = f"mining:{raw.hardware_model}:{raw.algorithm}:{raw.token_symbol}"

            signals.append(
                MinerSignal(
                    source=source,
                    hardware_model=raw.hardware_model,
                    algorithm=raw.algorithm,
                    token_symbol=raw.token_symbol,
                    hash_rate_th=raw.hash_rate_th,
                    power_w=raw.power_w,
                    electricity_cost_usd_per_kwh=raw.electricity_cost_usd_per_kwh,
                    hardware_cost_usd=raw.hardware_cost_usd,
                    revenue_usd_per_day=raw.revenue_usd_per_day,
                    detected_at=raw.detected_at,
                    external_id=raw.external_id,
                    daily_profit_usd=daily_profit_usd,
                    roi_percent_per_year=roi_percent_per_year,
                    payback_days=payback_days,
                    dedup_key=dedup_key,
                )
            )

        return signals

