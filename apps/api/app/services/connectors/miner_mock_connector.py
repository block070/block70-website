from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel


class MinerOpportunityRaw(BaseModel):
    """
    Structured raw miner ROI data for a specific project/hardware combo.

    These records are intentionally opinion-free: they expose economics that a
    signal extractor can turn into explicit ROI signals.
    """

    project_name: str
    token_symbol: str
    hardware_name: str
    hardware_cost: float
    power_draw_watts: int
    daily_token_yield: float
    token_price: float
    network_difficulty: float
    electricity_cost_per_kwh: float

    detected_at: datetime
    external_id: Optional[str] = None


class MinerMockConnector:
    """
    Mock connector that simulates mining hardware opportunities across several
    projects (Render, Filecoin, Alephium, Kaspa).

    This connector does NOT call any real APIs. It returns deterministic,
    hard-coded opportunities so that:
    - ROI profiles vary meaningfully between projects
    - downstream signal extraction can compute upside / payback / risk.
    """

    source_name = "miner_mock"

    def fetch_opportunities(self) -> List[MinerOpportunityRaw]:
        """
        Return mock miner opportunities with varied ROI characteristics.
        """
        now = datetime.now(timezone.utc)

        # Render Network – high-end GPU rig, attractive ROI
        render = MinerOpportunityRaw(
            project_name="Render GPU farm",
            token_symbol="RNDR",
            hardware_name="4x RTX 4090 rig",
            hardware_cost=12000.0,
            power_draw_watts=1800,
            daily_token_yield=85.0,
            token_price=7.5,
            network_difficulty=1.0,
            electricity_cost_per_kwh=0.08,
            detected_at=now,
            external_id="render-4x4090",
        )

        # Filecoin – storage miner, moderate ROI, heavier capex
        filecoin = MinerOpportunityRaw(
            project_name="Filecoin storage miner",
            token_symbol="FIL",
            hardware_name="128 TB storage miner",
            hardware_cost=18000.0,
            power_draw_watts=950,
            daily_token_yield=32.0,
            token_price=4.2,
            network_difficulty=1.4,
            electricity_cost_per_kwh=0.09,
            detected_at=now,
            external_id="filecoin-128tb",
        )

        # Alephium – lower capex, speculative ROI
        alephium = MinerOpportunityRaw(
            project_name="Alephium GPU miner",
            token_symbol="ALPH",
            hardware_name="2x RTX 4070 rig",
            hardware_cost=4200.0,
            power_draw_watts=520,
            daily_token_yield=65.0,
            token_price=1.1,
            network_difficulty=0.7,
            electricity_cost_per_kwh=0.10,
            detected_at=now,
            external_id="alephium-2x4070",
        )

        # Kaspa – ASIC-style rig, near break-even on power
        kaspa = MinerOpportunityRaw(
            project_name="Kaspa ASIC miner",
            token_symbol="KAS",
            hardware_name="Kaspa K10 Pro",
            hardware_cost=6500.0,
            power_draw_watts=3400,
            daily_token_yield=520.0,
            token_price=0.16,
            network_difficulty=1.9,
            electricity_cost_per_kwh=0.12,
            detected_at=now,
            external_id="kaspa-k10-pro",
        )

        return [render, filecoin, alephium, kaspa]

