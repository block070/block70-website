from __future__ import annotations

"""
Publisher for generated articles.

If a Block70 API base URL is configured, we POST directly to it. Otherwise we
log a warning and simply mark the source article as processed so it will not
be regenerated.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Any, List

import os

import requests

from .config import CONFIG
from .utils import infer_tags, log


@dataclass
class PublishResult:
    success: bool
    status_code: int | None
    response_body: Any | None


def _build_payload(
    *,
    title: str,
    content: str,
    source_url: str,
    sentiment: str,
    base_tags: List[str] | None = None,
) -> Dict[str, Any]:
    tags = base_tags or []
    if sentiment not in tags:
        tags.append(sentiment)

    return {
        "title": title,
        "content": content,
        "source_url": source_url,
        "category": "Crypto News",
        "tags": tags,
        "published_at": datetime.now(timezone.utc).isoformat(),
    }


def publish_article(
    *,
    title: str,
    content: str,
    source_url: str,
    sentiment: str,
) -> PublishResult:
    api_base = CONFIG.block70_api_base_url or os.environ.get("BLOCK70_API_BASE_URL")
    if not api_base:
        log(
            "WARNING",
            "BLOCK70_API_BASE_URL not set; skipping remote publish and only marking as processed.",
        )
        return PublishResult(success=False, status_code=None, response_body=None)

    payload = _build_payload(
        title=title,
        content=content,
        source_url=source_url,
        sentiment=sentiment,
        base_tags=infer_tags(title, content),
    )

    url = api_base.rstrip("/") + "/api/articles"
    try:
        resp = requests.post(url, json=payload, timeout=30)
        success = 200 <= resp.status_code < 300
        if success:
            log("INFO", f"Published article to Block70 API: {title}")
        else:
            log(
                "ERROR",
                f"Failed to publish article (status {resp.status_code}): {resp.text}",
            )
        return PublishResult(
            success=success,
            status_code=resp.status_code,
            response_body=resp.text,
        )
    except Exception as exc:
        log("ERROR", f"Exception publishing article to Block70 API: {exc}")
        return PublishResult(success=False, status_code=None, response_body=str(exc))

