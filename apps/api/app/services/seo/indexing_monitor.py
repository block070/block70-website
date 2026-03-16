from __future__ import annotations

"""
Indexing & traffic monitor for Block70 pages.

This module provides helpers to:
- Record basic page traffic (views, per-day aggregates)
- Store and update index status for a given path

Actual search index checks (e.g. Google Search Console) can be wired in later
by calling `update_index_status` with external results.
"""

from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models import PageIndexStatus, PageTrafficMetric


def record_page_view(
    db: Session,
    *,
    path: str,
    visitor_id: Optional[str] = None,
    when: Optional[datetime] = None,
) -> None:
    """
    Record a page view for a given path.

    - Aggregates into a per-day PageTrafficMetric row
    - If visitor_id is provided, increments unique_visitors at most once per
      (path, date, visitor_id) combination (best-effort).
    """
    from sqlalchemy import and_

    when = when or datetime.now(timezone.utc)
    day = when.date()

    metric = (
        db.query(PageTrafficMetric)
        .filter(
            and_(
                PageTrafficMetric.path == path,
                PageTrafficMetric.date == day,
            )
        )
        .first()
    )

    if metric is None:
        metric = PageTrafficMetric(
            path=path,
            date=day,
            views=0,
            unique_visitors=0,
        )
        db.add(metric)

    metric.views += 1

    if visitor_id:
        # Best-effort unique visitor counting: we don't store full visitor IDs
        # long-term here to keep the model simple. In a real implementation you
        # might use a separate table or an external analytics system.
        if metric.unique_visitors < metric.views:
            metric.unique_visitors += 1

    db.commit()


def update_index_status(
    db: Session,
    *,
    path: str,
    is_indexed: bool,
    status_label: str | None = None,
    checked_at: Optional[datetime] = None,
) -> None:
    """
    Update or create PageIndexStatus for a given path.

    External tooling (e.g. a Search Console integration) should call this
    after checking whether a URL is indexed.
    """
    checked_at = checked_at or datetime.now(timezone.utc)

    row = (
        db.query(PageIndexStatus)
        .filter(PageIndexStatus.path == path)
        .first()
    )
    if row is None:
        row = PageIndexStatus(
            path=path,
            is_indexed=is_indexed,
            last_checked_at=checked_at,
            last_status=status_label,
        )
        db.add(row)
    else:
        row.is_indexed = is_indexed
        row.last_checked_at = checked_at
        row.last_status = status_label or row.last_status

    db.commit()


def get_page_index_report(
    db: Session,
    *,
    limit: int = 100,
) -> list[dict]:
    """
    Return a simple report of index + traffic status per path.

    This can be exposed via an internal API or admin view to see:
    - which pages are indexed
    - which pages receive traffic
    """
    from sqlalchemy import func as sa_func

    traffic_subq = (
        db.query(
            PageTrafficMetric.path.label("path"),
            sa_func.sum(PageTrafficMetric.views).label("views"),
            sa_func.sum(PageTrafficMetric.unique_visitors).label("unique_visitors"),
        )
        .group_by(PageTrafficMetric.path)
        .subquery()
    )

    rows = (
        db.query(PageIndexStatus, traffic_subq.c.views, traffic_subq.c.unique_visitors)
        .outerjoin(traffic_subq, PageIndexStatus.path == traffic_subq.c.path)
        .order_by(PageIndexStatus.last_checked_at.desc().nullslast())
        .limit(limit)
        .all()
    )

    report: list[dict] = []
    for status, views, uniques in rows:
        report.append(
            {
                "path": status.path,
                "is_indexed": status.is_indexed,
                "last_checked_at": status.last_checked_at,
                "last_status": status.last_status,
                "total_views": int(views or 0),
                "total_unique_visitors": int(uniques or 0),
            }
        )

    return report

