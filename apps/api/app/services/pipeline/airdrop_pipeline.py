from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, List

import feedparser
from sqlalchemy.orm import Session

from app.models import Opportunity
from app.services.pipeline.deduplication import upsert_opportunity_by_identity


COINDESK_RSS = "https://www.coindesk.com/arc/outboundfeeds/rss/"
COINTELEGRAPH_RSS = "https://cointelegraph.com/rss"


def _looks_like_airdrop(title: str, summary: str) -> bool:
    text = f"{title} {summary}".lower()
    keywords = (
        "airdrop",
        "points",
        "quest",
        "testnet",
        "incentive",
        "claim",
        "allocation",
    )
    return any(k in text for k in keywords)


def _iter_feed_entries(urls: Iterable[str]) -> Iterable[tuple[str, dict]]:
    for url in urls:
        parsed = feedparser.parse(url)
        for entry in parsed.entries:
            yield url, entry


def run_airdrop_pipeline(db: Session, *, limit: int = 30) -> List[Opportunity]:
    """
    Strict real-data airdrop pipeline.

    We do not use any paid airdrop APIs. Instead, we ingest real RSS entries from
    trusted crypto news feeds and surface only items that look like airdrop /
    points / testnet / incentive programs.

    Output is persisted into the shared Opportunity table as type='airdrop',
    deduped by (type, chain, asset_symbol, source_ref) identity, where source_ref
    is the canonical source URL.
    """
    created: List[Opportunity] = []
    now = datetime.now(timezone.utc)
    urls = [COINDESK_RSS, COINTELEGRAPH_RSS]

    seen = 0
    for _feed_url, entry in _iter_feed_entries(urls):
        if seen >= limit:
            break

        title = str(getattr(entry, "title", "") or "").strip()
        link = str(getattr(entry, "link", "") or "").strip()
        summary = (
            str(getattr(entry, "summary", "") or "").strip()
            or str(getattr(entry, "description", "") or "").strip()
        )
        if not title or not link:
            continue

        if not _looks_like_airdrop(title, summary):
            continue

        opp = Opportunity(
            title=title[:255],
            slug=f"airdrop-{abs(hash(link))}",
            type="airdrop",
            chain=None,
            status="active",
            summary=summary[:2000] if summary else None,
            thesis=None,
            asset_symbol=None,
            base_symbol=None,
            quote_symbol=None,
            source="RSS Airdrop Monitor",
            source_ref=link,
            estimated_cost=None,
            estimated_upside=None,
            estimated_roi_percent=None,
            confidence_score=0.5,
            upside_score=0.3,
            freshness_score=1.0,
            liquidity_score=0.0,
            accessibility_score=0.8,
            risk_score=0.6,
            difficulty_score=0.6,
            total_score=0.5,
            risk_level="medium",
            difficulty_level="medium",
            detected_at=now,
            expires_at=None,
            last_seen_at=now,
            raw_payload={
                "rss": {
                    "title": title,
                    "url": link,
                }
            },
        )

        persisted = upsert_opportunity_by_identity(db, opp)
        created.append(persisted)
        seen += 1

    db.commit()
    return created

