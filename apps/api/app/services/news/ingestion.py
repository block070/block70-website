from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import NewsArticle, NewsCluster, NewsEntity, NewsRawEvent
from app.schemas.news import NewsIngestionResult
from app.services.news.adapters import (
    BlockworksScrapeAdapter,
    CoinDeskApiAdapter,
    CoinDeskRssAdapter,
    CointelegraphRssAdapter,
    DecryptRssAdapter,
)
from app.services.news.cache import news_fetch_cache
from app.services.news.dedupe import cluster_articles, normalize_title_key
from app.services.news.entities import extract_entities
from app.services.news.logger import logger
from app.services.news.normalize import normalize_source_article
from app.services.news.quality import evaluate_quality
from app.services.news.ranking import coin_page_score, homepage_score
from app.services.news.types import SourceArticle, SourceFetchResult


class NewsIngestionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.adapters = [
            CoinDeskApiAdapter(),
            CoinDeskRssAdapter(),
            CointelegraphRssAdapter(),
            DecryptRssAdapter(),
            BlockworksScrapeAdapter(),
        ]

    def ingest_latest(self, limit_per_source: int = 50) -> NewsIngestionResult:
        started = datetime.now(timezone.utc)
        results: list[SourceFetchResult] = []
        source_errors: list[dict] = []
        with ThreadPoolExecutor(max_workers=len(self.adapters)) as pool:
            futures = [pool.submit(adapter.fetch_latest, limit_per_source) for adapter in self.adapters]
            for future in as_completed(futures):
                result = future.result()
                results.append(result)
                logger.info(
                    "news.fetch",
                    extra={
                        "source": result.source,
                        "adapter": result.adapter,
                        "duration_ms": result.duration_ms,
                        "items": len(result.items),
                        "error": result.error,
                    },
                )
                self.db.add(
                    NewsRawEvent(
                        source=result.source,
                        adapter=result.adapter,
                        payload={"items": [item.raw for item in result.items]},
                        request_meta={**result.request_meta, "duration_ms": result.duration_ms},
                        parse_error=result.error,
                    )
                )
                if result.error:
                    source_errors.append(
                        {"source": result.source, "adapter": result.adapter, "error": result.error}
                    )

        normalized: list[SourceArticle] = []
        for result in results:
            for item in result.items:
                try:
                    normalized.append(normalize_source_article(item))
                except Exception as exc:  # noqa: BLE001
                    source_errors.append(
                        {"source": result.source, "adapter": result.adapter, "error": f"normalize: {exc}"}
                    )

        clusters = cluster_articles(normalized)
        persisted = 0
        for cluster_items in clusters:
            canonical = sorted(
                cluster_items,
                key=lambda item: (
                    0 if item.published_at else 1,
                    item.published_at or datetime.now(timezone.utc),
                    -len((item.body_text or item.summary or "")),
                ),
            )[0]
            quality = evaluate_quality(canonical)
            if quality.action == "drop":
                continue

            extracted = extract_entities(canonical)
            canonical.tickers = sorted(set((canonical.tickers or []) + extracted.tickers))
            canonical.entities = (canonical.entities or []) + extracted.entities

            existing = (
                self.db.query(NewsArticle)
                .filter(NewsArticle.url == canonical.url)
                .first()
            )
            source_count = len({item.source for item in cluster_items})
            hp_score, explanation = homepage_score(canonical, source_count)
            coin_scores: dict[str, float] = {}
            for ticker in canonical.tickers:
                score, _ = coin_page_score(canonical, ticker, source_count)
                coin_scores[ticker] = score

            if existing:
                existing.title = canonical.title
                existing.source = canonical.source
                existing.source_type = canonical.source_type
                existing.author = canonical.author
                existing.summary = canonical.summary
                existing.content = canonical.summary
                existing.body_text = canonical.body_text
                existing.image_url = canonical.image_url
                existing.tags = canonical.tags
                existing.tickers = canonical.tickers
                existing.entities = canonical.entities
                existing.published_at = canonical.published_at
                existing.sentiment = canonical.sentiment
                existing.engagement = canonical.engagement
                existing.rank_explanation = {**explanation, "quality_reason": quality.reason}
                existing.homepage_score = hp_score - (15 if quality.action == "downrank" else 0)
                existing.coin_scores = coin_scores
                existing.source_count = source_count
                existing.dedupe_count = len(cluster_items)
                existing.quality_status = quality.action
                article_row = existing
            else:
                article_row = NewsArticle(
                    title=canonical.title,
                    source=canonical.source,
                    source_type=canonical.source_type,
                    url=canonical.url,
                    author=canonical.author,
                    summary=canonical.summary,
                    content=canonical.summary,
                    body_text=canonical.body_text,
                    image_url=canonical.image_url,
                    tags=canonical.tags,
                    tickers=canonical.tickers,
                    entities=canonical.entities,
                    published_at=canonical.published_at,
                    sentiment=canonical.sentiment,
                    engagement=canonical.engagement,
                    rank_explanation={**explanation, "quality_reason": quality.reason},
                    homepage_score=hp_score - (15 if quality.action == "downrank" else 0),
                    coin_scores=coin_scores,
                    source_count=source_count,
                    dedupe_count=len(cluster_items),
                    quality_status=quality.action,
                )
                self.db.add(article_row)
                self.db.flush()

            cluster = (
                self.db.query(NewsCluster)
                .filter(NewsCluster.title_key == normalize_title_key(canonical.title))
                .first()
            )
            if not cluster:
                cluster = NewsCluster(
                    canonical_article_id=article_row.id,
                    title_key=normalize_title_key(canonical.title),
                    source_count=source_count,
                    article_count=len(cluster_items),
                    time_window_start=min(
                        [i.published_at for i in cluster_items if i.published_at], default=None
                    ),
                    time_window_end=max(
                        [i.published_at for i in cluster_items if i.published_at], default=None
                    ),
                )
                self.db.add(cluster)
                self.db.flush()
            else:
                cluster.canonical_article_id = article_row.id
                cluster.source_count = source_count
                cluster.article_count = len(cluster_items)

            article_row.dedupe_cluster_id = cluster.id
            self.db.query(NewsEntity).filter(NewsEntity.article_id == article_row.id).delete()
            for entity in canonical.entities:
                if not isinstance(entity, dict) or not entity.get("value"):
                    continue
                self.db.add(
                    NewsEntity(
                        article_id=article_row.id,
                        entity_type=str(entity.get("type", "unknown")),
                        value=str(entity.get("value")),
                        normalized_value=(
                            str(entity.get("normalized_value"))
                            if entity.get("normalized_value") is not None
                            else None
                        ),
                        extra=entity,
                    )
                )
            persisted += 1

        self.db.commit()
        completed = datetime.now(timezone.utc)
        return NewsIngestionResult(
            started_at=started,
            completed_at=completed,
            sources_attempted=len(self.adapters),
            sources_succeeded=len([r for r in results if not r.error]),
            source_errors=source_errors,
            items_fetched=sum(len(r.items) for r in results),
            items_normalized=len(normalized),
            items_persisted=persisted,
            clusters_created=len(clusters),
            cache_hits=news_fetch_cache.stats.hits,
            cache_misses=news_fetch_cache.stats.misses,
        )
