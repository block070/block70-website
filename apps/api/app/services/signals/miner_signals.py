from __future__ import annotations

from datetime import datetime
from typing import List, Literal

from pydantic import BaseModel
from typing_extensions import TypedDict

from app.services.connectors.miner_mock_connector import MinerOpportunityRaw


class MinerSignalValue(TypedDict):
    project_name: str
    token_symbol: str
    hardware_name: str
    hardware_cost: float
    power_draw_watts: int
    daily_token_yield: float
    token_price: float
    network_difficulty: float
    electricity_cost_per_kwh: float

    daily_revenue_usd: float
    monthly_revenue_usd: float
    electricity_cost_usd: float
    net_monthly_profit: float
    roi_months: float
    roi_percent: float


class MinerSignal(BaseModel):
    """
    Structured miner ROI signal suitable for feeding into the Opportunity Engine.
    """

    signal_type: Literal["mining_roi"]
    value: MinerSignalValue
    confidence: float
    timestamp: datetime


class MinerSignalExtractor:
    """
    Converts raw miner hardware economics into explicit ROI signals.

    This layer does not decide whether to persist an opportunity, it only
    computes explainable ROI metrics.
    """

    def extract(self, raw_items: List[MinerOpportunityRaw]) -> List[MinerSignal]:
        signals: List[MinerSignal] = []

        for raw in raw_items:
            # Revenue side
            daily_revenue_usd = raw.daily_token_yield * raw.token_price
            monthly_revenue_usd = daily_revenue_usd * 30.0

            # Power cost (approximate)
            daily_kwh = raw.power_draw_watts * 24.0 / 1000.0
            monthly_kwh = daily_kwh * 30.0
            electricity_cost_usd = monthly_kwh * raw.electricity_cost_per_kwh

            # Net profit and ROI
            net_monthly_profit = monthly_revenue_usd - electricity_cost_usd
            if net_monthly_profit > 0:
                roi_months = raw.hardware_cost / net_monthly_profit
                roi_percent = (net_monthly_profit * 12.0 / raw.hardware_cost) * 100.0
            else:
                roi_months = float("inf")
                roi_percent = -100.0

            # Only produce opportunity candidates with payback under 18 months.
            if roi_months >= 18.0:
                continue

            # Simple confidence heuristic:
            # - Better ROI (shorter payback) → higher confidence
            # - Clamp to [0, 1]
            if roi_months <= 8:
                confidence = 0.9
            elif roi_months <= 12:
                confidence = 0.75
            else:
                confidence = 0.6

            value: MinerSignalValue = {
                "project_name": raw.project_name,
                "token_symbol": raw.token_symbol,
                "hardware_name": raw.hardware_name,
                "hardware_cost": raw.hardware_cost,
                "power_draw_watts": raw.power_draw_watts,
                "daily_token_yield": raw.daily_token_yield,
                "token_price": raw.token_price,
                "network_difficulty": raw.network_difficulty,
                "electricity_cost_per_kwh": raw.electricity_cost_per_kwh,
                "daily_revenue_usd": daily_revenue_usd,
                "monthly_revenue_usd": monthly_revenue_usd,
                "electricity_cost_usd": electricity_cost_usd,
                "net_monthly_profit": net_monthly_profit,
                "roi_months": roi_months,
                "roi_percent": roi_percent,
            }

            signals.append(
                MinerSignal(
                    signal_type="mining_roi",
                    value=value,
                    confidence=confidence,
                    timestamp=raw.detected_at,
                )
            )

        return signals

