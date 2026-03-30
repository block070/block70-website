from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import UsageMetric


def record_usage_metric(
    db: Session,
    user_id: int,
    metric_type: str,
    metric_value: int = 1,
) -> None:
    metric = UsageMetric(
        user_id=user_id,
        metric_type=metric_type,
        metric_value=metric_value,
    )
    db.add(metric)
    db.commit()
