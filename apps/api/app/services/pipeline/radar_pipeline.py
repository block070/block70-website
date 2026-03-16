from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import Opportunity, RadarSignal
from app.services.scoring.radar_event_engine import RadarEvent, RadarEventEngine
from app.services.pipeline.alert_engine import evaluate_radar_alerts
from app.services.pipeline.deduplication import upsert_opportunity_by_identity


class RadarPipeline:
    """
    High-level Crypto Radar pipeline.

    Steps:
    1. Collect RadarSignals from the database (optionally since a cutoff time).
    2. Group signals by token_symbol and aggregate into RadarEvents.
    3. Persist aggregated RadarEvents back into the radar_signals table as
       synthesized "radar_event" entries (one per token / chain).
    4. Expire old radar_event entries so the radar stays focused on recent data.
    """

    def __init__(
        self,
        *,
        max_signals_for_normalization: int = 10,
        radar_event_ttl_hours: int = 24,
    ) -> None:
        self._engine = RadarEventEngine(
            max_signals_for_normalization=max_signals_for_normalization
        )
        self._ttl = max(1, int(radar_event_ttl_hours))

    def run(
        self,
        db: Session,
        *,
        since: Optional[datetime] = None,
        min_event_score: float = 0.4,
        min_opportunity_event_score: float = 0.7,
    ) -> List[RadarEvent]:
        """
        Execute the radar pipeline:

        - collect RadarSignals (optionally only those created after `since`)
        - aggregate into RadarEvents
        - persist each RadarEvent as a synthesized RadarSignal of type "radar_event"
        - expire stale "radar_event" entries
        """
        # Aggregate events using the RadarEventEngine. The engine itself
        # loads RadarSignal rows from the DB.
        events = self._engine.aggregate(
            db,
            since=since,
            min_event_score=min_event_score,
        )

        # Persist aggregated events as synthetic radar_event signals and, when
        # strong enough, as normalized radar-type Opportunities.
        for ev in events:
            radar_event_signal = RadarSignal(
                signal_type="radar_event",
                token_symbol=ev.token_symbol,
                chain=ev.chain,
                signal_strength=ev.event_score,
                confidence_score=ev.avg_confidence_score,
                source="RadarEventEngine",
                metadata_json={
                    "event_score": ev.event_score,
                    "signal_count": ev.signal_count,
                    "avg_signal_strength": ev.avg_signal_strength,
                    "avg_confidence_score": ev.avg_confidence_score,
                    "recency_score": ev.recency_score,
                    "latest_signal_at": ev.latest_signal_at.isoformat(),
                    "signal_types": ev.signal_types,
                },
            )
            db.add(radar_event_signal)

            # Automatically generate a radar Opportunity when the event_score
            # exceeds the configured threshold.
            if ev.event_score >= min_opportunity_event_score:
                title = f"Radar cluster detected on {ev.token_symbol}"
                summary = (
                    f"Crypto Radar detected {ev.signal_count} aligned signals for "
                    f"{ev.token_symbol} across {', '.join(ev.signal_types) or 'multiple detectors'} "
                    f"with a radar score of ~{ev.event_score * 100:.0f}%."
                )

                slug = f"radar-{ev.token_symbol.lower()}-{ev.latest_signal_at.strftime('%Y%m%d%H%M')}"

                opportunity = Opportunity(
                    title=title,
                    slug=slug,
                    type="radar",
                    chain=ev.chain,
                    status="active",
                    summary=summary,
                    thesis=None,
                    asset_symbol=ev.token_symbol,
                    base_symbol=ev.token_symbol,
                    quote_symbol=None,
                    source="Radar Engine",
                    source_ref=None,
                    estimated_cost=None,
                    estimated_upside=ev.event_score * 100.0,
                    estimated_roi_percent=None,
                    confidence_score=ev.avg_confidence_score,
                    upside_score=0.0,
                    freshness_score=ev.recency_score,
                    liquidity_score=0.0,
                    accessibility_score=0.0,
                    risk_score=0.0,
                    difficulty_score=0.0,
                    total_score=0.0,
                    risk_level=None,
                    difficulty_level=None,
                    detected_at=ev.latest_signal_at,
                    expires_at=None,
                    last_seen_at=ev.latest_signal_at,
                    dedup_key=None,
                    raw_payload={
                        "radar_event": {
                            "event_score": ev.event_score,
                            "signal_count": ev.signal_count,
                            "avg_signal_strength": ev.avg_signal_strength,
                            "avg_confidence_score": ev.avg_confidence_score,
                            "recency_score": ev.recency_score,
                            "latest_signal_at": ev.latest_signal_at.isoformat(),
                            "signal_types": ev.signal_types,
                        }
                    },
                )

                upsert_opportunity_by_identity(db, opportunity)

        # Evaluate radar_event alerts based on the newly aggregated events.
        if events:
            evaluate_radar_alerts(db, events)

        # Expire old radar_event entries.
        self._expire_old_events(db)

        db.commit()
        return events

    def _expire_old_events(self, db: Session) -> int:
        """
        Remove stale synthesized radar_event entries older than the configured TTL.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=self._ttl)
        q = db.query(RadarSignal).filter(
            RadarSignal.signal_type == "radar_event",
            RadarSignal.created_at < cutoff,
        )
        count = q.count()
        if count:
            q.delete(synchronize_session=False)
        return count

