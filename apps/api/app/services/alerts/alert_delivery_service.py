from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List


class DeliveryChannel(str, Enum):
    EMAIL = "email"
    WEB = "web"
    TELEGRAM = "telegram"  # reserved for future use


@dataclass
class AlertDelivery:
    """
    Normalized alert delivery payload.
    """

    user_identifier: str
    channel: DeliveryChannel

    title: str
    body: str

    # Optional metadata such as opportunity_id, token_symbol, etc.
    metadata: Dict[str, Any]


class _InMemoryRateLimiter:
    """
    Simple in-memory rate limiter for alert delivery.

    This implementation is process-local and intended for development /
    single-process deployments. In production it should be replaced with a
    shared store (e.g. Redis) using the same interface.
    """

    def __init__(
        self,
        *,
        max_alerts_per_window: int = 10,
        window_seconds: int = 60,
    ) -> None:
        self._max = int(max_alerts_per_window)
        self._window = max(1, int(window_seconds))
        # user_identifier -> list of send timestamps (UTC)
        self._events: Dict[str, List[datetime]] = defaultdict(list)

    def allow(self, user_identifier: str, now: datetime | None = None) -> bool:
        now = now or datetime.now(timezone.utc)
        bucket = self._events[user_identifier]
        cutoff = now - timedelta(seconds=self._window)
        # Drop events outside the window
        while bucket and bucket[0] < cutoff:
            bucket.pop(0)

        if len(bucket) >= self._max:
            return False

        bucket.append(now)
        return True


class AlertDeliveryService:
    """
    High-level service responsible for preparing alert deliveries through
    supported channels with basic rate limiting to avoid spamming users.

    Supported channels today:
    - email
    - web notifications

    Prepared for future Telegram alerts via DeliveryChannel.TELEGRAM.

    This service does not directly send alerts; instead it returns
    AlertDelivery objects for downstream channel-specific senders.
    """

    def __init__(
        self,
        *,
        max_alerts_per_window: int = 10,
        window_seconds: int = 60,
    ) -> None:
        self._limiter = _InMemoryRateLimiter(
            max_alerts_per_window=max_alerts_per_window,
            window_seconds=window_seconds,
        )

    def prepare_deliveries(
        self,
        *,
        user_identifier: str,
        title: str,
        body: str,
        metadata: Dict[str, Any] | None = None,
        channels: List[DeliveryChannel] | None = None,
    ) -> List[AlertDelivery]:
        """
        Prepare AlertDelivery objects for the given user and channels,
        subject to rate limiting.

        If the user has exceeded the per-window alert budget, this method
        returns an empty list.
        """
        if not self._limiter.allow(user_identifier):
            return []

        metadata = metadata or {}
        channels = channels or [DeliveryChannel.EMAIL, DeliveryChannel.WEB]

        deliveries: List[AlertDelivery] = []
        for channel in channels:
            if channel == DeliveryChannel.TELEGRAM:
                # Placeholder: Telegram integration can be wired here in the
                # future without changing the public interface.
                continue

            deliveries.append(
                AlertDelivery(
                    user_identifier=user_identifier,
                    channel=channel,
                    title=title,
                    body=body,
                    metadata=metadata,
                )
            )

        return deliveries

