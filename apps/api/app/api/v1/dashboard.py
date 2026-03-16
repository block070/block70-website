from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import User, DashboardWidget
from app.schemas.dashboard import (
    DashboardLayoutRead,
    DashboardLayoutUpdate,
    DashboardWidgetRead,
)
from app.services.dashboard.layout_engine import (
    load_user_layout,
    save_user_layout,
    reset_layout,
    LAYOUT_TEMPLATES,
)


router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/layout", response_model=DashboardLayoutRead)
def get_layout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardLayoutRead:
    """Get current user's dashboard layout."""
    data = load_user_layout(db, current_user.id)
    return DashboardLayoutRead(**data)


@router.post("/layout", response_model=DashboardLayoutRead)
def post_layout(
    payload: DashboardLayoutUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardLayoutRead:
    """Save dashboard layout for the current user."""
    save_user_layout(db, current_user.id, payload.model_dump())
    return DashboardLayoutRead(layout=payload.layout)


@router.post("/layout/reset", response_model=DashboardLayoutRead)
def post_layout_reset(
    template: str | None = Query(None, description="Template: trader, research, airdrop_hunter, whale_watcher"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardLayoutRead:
    """Reset dashboard to default or to a named template (trader, research, airdrop_hunter, whale_watcher)."""
    data = reset_layout(db, current_user.id, template=template)
    return DashboardLayoutRead(**data)


@router.get("/widgets", response_model=list[DashboardWidgetRead])
def list_widgets(
    db: Session = Depends(get_db),
) -> list[DashboardWidgetRead]:
    """List available dashboard widgets (catalog)."""
    rows = db.query(DashboardWidget).order_by(DashboardWidget.widget_name).all()
    if not rows:
        return _default_widgets_schema()
    return [DashboardWidgetRead.model_validate(r) for r in rows]


def _default_widgets_schema() -> list[DashboardWidgetRead]:
    """Return default widget definitions when DB table is empty."""
    defaults = [
        {"id": 1, "widget_name": "Signals", "widget_type": "signals", "description": "Latest signals in compact feed", "default_position": {"i": "signals", "x": 0, "y": 0, "w": 6, "h": 3}, "created_at": "2025-01-01T00:00:00Z"},
        {"id": 2, "widget_name": "Whale Activity", "widget_type": "whale", "description": "Recent large trades", "default_position": {"i": "whale", "x": 8, "y": 3, "w": 4, "h": 2}, "created_at": "2025-01-01T00:00:00Z"},
        {"id": 3, "widget_name": "Opportunities", "widget_type": "opportunities", "description": "Top opportunities by alpha score", "default_position": {"i": "opportunities", "x": 6, "y": 0, "w": 6, "h": 3}, "created_at": "2025-01-01T00:00:00Z"},
        {"id": 4, "widget_name": "Trending Coins", "widget_type": "trending-coins", "description": "Trending tokens", "default_position": {"i": "trending-coins", "x": 4, "y": 3, "w": 4, "h": 2}, "created_at": "2025-01-01T00:00:00Z"},
        {"id": 5, "widget_name": "Market Overview", "widget_type": "market-overview", "description": "Key market stats", "default_position": {"i": "market-overview", "x": 0, "y": 3, "w": 4, "h": 2}, "created_at": "2025-01-01T00:00:00Z"},
        {"id": 6, "widget_name": "Airdrops", "widget_type": "airdrop", "description": "Active and high-value airdrops", "default_position": {"i": "airdrop", "x": 0, "y": 5, "w": 6, "h": 2}, "created_at": "2025-01-01T00:00:00Z"},
        {"id": 7, "widget_name": "Wallet Activity", "widget_type": "wallet-activity", "description": "Smart wallet transactions", "default_position": {"i": "wallet-activity", "x": 6, "y": 5, "w": 6, "h": 2}, "created_at": "2025-01-01T00:00:00Z"},
    ]
    from datetime import datetime, timezone
    ts = datetime.now(timezone.utc)
    return [
        DashboardWidgetRead(
            id=d["id"],
            widget_name=d["widget_name"],
            widget_type=d["widget_type"],
            description=d["description"],
            default_position=d["default_position"],
            created_at=ts,
        )
        for d in defaults
    ]


@router.get("/templates")
def list_templates() -> dict[str, list[str]]:
    """Return available layout template names."""
    return {"templates": list(LAYOUT_TEMPLATES.keys())}
