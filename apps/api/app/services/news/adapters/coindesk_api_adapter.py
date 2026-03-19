from __future__ import annotations

import os
import time
from datetime import datetime, timezone

from app.services.news.adapters.base import NewsSourceAdapter
from app.services.news.http import cached_get_json
from app.services.news.types import SourceArticle, SourceFetchResult


class CoinDeskApiAdapter(NewsSourceAdapter):
    source = "CoinDesk"
    adapter_name = "coindeskApiAdapter"
    base_url = "https://data-api.coindesk.com/news/v1/article/list"

    def fetch_latest(self, limit: int = 50) -> SourceFetchResult:
        started = time.perf_counter()
        api_key = os.getenv("COINDESK_API_KEY")
        headers = {"authorization": f"Apikey {api_key}"} if api_key else {}
        url = f"{self.base_url}?lang=EN&limit={max(1, min(limit, 100))}"
        try:
            data, cache_hit = cached_get_json(url, ttl_seconds=180, headers=headers)
            data_items = ((data.get("Data") or {}).get("LIST") or [])
            items: list[SourceArticle] = []
            for row in data_items:
                if not isinstance(row, dict):
                    continue
                title = (row.get("TITLE") or "").strip()
                url_value = (row.get("URL") or "").strip()
                if not title or not url_value:
                    continue

                published_at = None
                published_ts = row.get("PUBLISHED_ON")
                if isinstance(published_ts, int):
                    published_at = datetime.fromtimestamp(published_ts, tz=timezone.utc)

                body = row.get("BODY")
                items.append(
                    SourceArticle(
                        source=self.source,
                        source_type="api",
                        title=title,
                        url=url_value,
                        published_at=published_at,
                        author=(row.get("AUTHOR") or None),
                        summary=(row.get("SUMMARY") or None),
                        body_text=body if isinstance(body, str) else None,
                        image_url=(row.get("IMAGE_URL") or None),
                        tags=[str(v) for v in (row.get("CATEGORY_DATA") or []) if isinstance(v, str)],
                        raw=row,
                    )
                )
            return SourceFetchResult(
                source=self.source,
                adapter=self.adapter_name,
                items=items,
                duration_ms=int((time.perf_counter() - started) * 1000),
                request_meta={"cache_hit": cache_hit, "url": url, "api_key_present": bool(api_key)},
            )
        except Exception as exc:  # noqa: BLE001
            return SourceFetchResult(
                source=self.source,
                adapter=self.adapter_name,
                items=[],
                duration_ms=int((time.perf_counter() - started) * 1000),
                error=str(exc),
                request_meta={"url": url, "api_key_present": bool(api_key)},
            )
