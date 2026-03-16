from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

import redis
from sqlalchemy.orm import Session

from app.models import StreamEvent


_REDIS_CLIENT: Optional[redis.Redis] = None


def _get_redis() -> redis.Redis:
    """
    Lazily create a Redis client for publishing / consuming events.
    """
    global _REDIS_CLIENT
    if _REDIS_CLIENT is None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _REDIS_CLIENT = redis.Redis.from_url(url, decode_responses=True)
    return _REDIS_CLIENT


STREAM_KEY = os.getenv("EVENT_STREAM_KEY", "block70:event-stream")


def publish_event(
    db: Session,
    *,
    event_type: str,
    source: str,
    token_symbol: Optional[str],
    chain: Optional[str],
    payload: Dict[str, Any],
) -> StreamEvent:
    """
    Persist and publish a StreamEvent into the Redis stream.

    This function is safe to call from connectors. If Redis is unavailable,
    the database record is still created so that the event can be replayed
    later.
    """
    serialized_payload = json.dumps(payload, separators=(",", ":"))

    event = StreamEvent(
        event_type=event_type,
        source=source,
        token_symbol=token_symbol,
        chain=chain,
        payload_json=serialized_payload,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Best-effort push into Redis Stream.
    try:
        client = _get_redis()
        client.xadd(
            STREAM_KEY,
            {
                "id": str(event.id),
                "event_type": event.event_type,
                "source": event.source,
                "token_symbol": event.token_symbol or "",
                "chain": event.chain or "",
                "payload_json": event.payload_json,
            },
            maxlen=10_000,
            approximate=True,
        )
    except Exception:
        # Do not raise from producers; streaming can be debugged separately.
        pass

    return event


def consume_events(
    *,
    group: str,
    consumer: str,
    count: int = 50,
    block_ms: int = 1000,
) -> List[Dict[str, Any]]:
    """
    Consume events from the Redis stream using a consumer group.

    Returns a list of dicts:
    {
      "stream_id": "<redis id>",
      "id": <db id or None>,
      "event_type": "...",
      "source": "...",
      "token_symbol": "...",
      "chain": "...",
      "payload": { ... },
    }

    Multiple consumers can share the same group name; Redis will
    fairly distribute events across them.
    """
    client = _get_redis()

    # Ensure the consumer group exists.
    try:
        client.xgroup_create(
            STREAM_KEY,
            group,
            id="0-0",
            mkstream=True,
        )
    except redis.ResponseError as exc:
        # BUSYGROUP simply means it already exists.
        if "BUSYGROUP" not in str(exc):
            raise

    response = client.xreadgroup(
        groupname=group,
        consumername=consumer,
        streams={STREAM_KEY: ">"},
        count=count,
        block=block_ms,
    )

    if not response:
        return []

    events: List[Dict[str, Any]] = []

    for _, entries in response:
        for stream_id, fields in entries:
            try:
                payload_dict = json.loads(fields.get("payload_json", "{}"))
            except json.JSONDecodeError:
                payload_dict = {}

            db_id: Optional[int] = None
            try:
                raw_id = fields.get("id")
                if raw_id is not None:
                    db_id = int(raw_id)
            except (TypeError, ValueError):
                db_id = None

            events.append(
                {
                    "stream_id": stream_id,
                    "id": db_id,
                    "event_type": fields.get("event_type", ""),
                    "source": fields.get("source", ""),
                    "token_symbol": fields.get("token_symbol") or None,
                    "chain": fields.get("chain") or None,
                    "payload": payload_dict,
                }
            )

    return events


def ack_events(
    *,
    group: str,
    stream_ids: List[str],
) -> None:
    """
    Acknowledge processed stream messages so Redis does not redeliver them.
    Call after successfully processing events returned by consume_events.
    """
    if not stream_ids:
        return
    try:
        client = _get_redis()
        client.xack(STREAM_KEY, group, *stream_ids)
    except Exception:
        pass

