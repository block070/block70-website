from datetime import datetime, timedelta, timezone
from typing import List

from app.schemas.signals import MinerRaw


class MockMinerConnector:
    """
    Mock miner ROI connector.

    In production this would call mining calculators and network stats APIs.
    For now, it returns realistic-looking static data for common ASIC rigs.
    """

    source_name = "mock_miner_roi"

    def fetch_raw(self) -> List[MinerRaw]:
        now = datetime.now(timezone.utc)
        return [
            MinerRaw(
                hardware_model="Antminer S19 Pro",
                algorithm="SHA-256",
                token_symbol="BTC",
                hash_rate_th=110.0,
                power_w=3250,
                electricity_cost_usd_per_kwh=0.06,
                hardware_cost_usd=2200.0,
                revenue_usd_per_day=8.5,
                detected_at=now - timedelta(hours=1),
                external_id="antminer-s19-pro-btc",
            ),
            MinerRaw(
                hardware_model="L7 9.5Gh",
                algorithm="Scrypt",
                token_symbol="LTC",
                hash_rate_th=0.0095,
                power_w=3425,
                electricity_cost_usd_per_kwh=0.09,
                hardware_cost_usd=3200.0,
                revenue_usd_per_day=6.2,
                detected_at=now - timedelta(hours=2),
                external_id="antminer-l7-9_5gh-ltc",
            ),
        ]

