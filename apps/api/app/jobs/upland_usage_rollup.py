"""Nightly rollup: materialize the previous UTC day's Redis counters into
upland_usage_daily so we have durable history.

Designed to be called from a scheduler (the existing APScheduler config, an
external cron, or a SIG-triggered manual run). The job is idempotent: it uses
ON CONFLICT DO UPDATE keyed on (user_id, day_utc, metric).

Redis key shape (see apps/web/lib/upland/rate-limit.ts):
    upland:usage:u<user_id>:<yyyy-mm-dd>         -> scalar counter (GET)
    upland:usage:ip<hashed-ip>:<yyyy-mm-dd>      -> ignored (anon)

Run manually:
    python -m app.jobs.upland_usage_rollup
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text

from app.db import engine

logger = logging.getLogger(__name__)


def _yesterday_utc() -> date:
    return (datetime.now(timezone.utc) - timedelta(days=1)).date()


def rollup_previous_day(target_day: date | None = None) -> int:
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        logger.warning("upland_usage_rollup: REDIS_URL unset; nothing to roll up")
        return 0
    try:
        import redis  # type: ignore
    except ImportError:
        logger.warning("upland_usage_rollup: redis package unavailable; skipping")
        return 0

    day = target_day or _yesterday_utc()
    day_stamp = day.isoformat()
    prefix = f"upland:usage:u"
    pattern = f"{prefix}*:{day_stamp}"

    client = redis.from_url(redis_url, decode_responses=True)
    total_rows = 0

    # SCAN through user counter keys for the target day.
    cursor: int = 0
    while True:
        cursor, keys = client.scan(cursor=cursor, match=pattern, count=200)
        if keys:
            _upsert_batch(day, keys, client)
            total_rows += len(keys)
        if cursor == 0:
            break

    logger.info(
        "upland_usage_rollup complete: day=%s rows=%d",
        day_stamp,
        total_rows,
    )
    return total_rows


def _upsert_batch(day: date, keys: list[str], client) -> None:  # type: ignore[no-untyped-def]
    # Fetch counts with MGET to minimize round trips.
    values = client.mget(keys)
    rows: list[tuple[int, str, int, str]] = []
    for key, value in zip(keys, values):
        if value is None:
            continue
        # key format: upland:usage:u<user_id>:<yyyy-mm-dd>
        try:
            scope = key.split(":", 3)[2]  # "u<user_id>"
            user_id = int(scope[1:])
            count = int(value)
        except (IndexError, ValueError):
            continue
        rows.append((user_id, day.isoformat(), count, "search"))

    if not rows:
        return

    with engine.connect() as conn:
        for user_id, day_iso, count, metric in rows:
            conn.execute(
                text(
                    """
                    INSERT INTO upland_usage_daily (user_id, day_utc, metric, count, tier)
                    VALUES (:user_id, :day_utc, :metric, :count, 'unknown')
                    ON CONFLICT (user_id, day_utc, metric)
                    DO UPDATE SET count = EXCLUDED.count
                    """
                ),
                {
                    "user_id": user_id,
                    "day_utc": day_iso,
                    "metric": metric,
                    "count": count,
                },
            )
        conn.commit()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    rollup_previous_day()
