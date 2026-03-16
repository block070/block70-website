"""
Dashboard layout engine: load, save, and reset user dashboard layouts.
Layout format is React Grid Layout: list of { i, x, y, w, h }.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import UserDashboardLayout, DashboardWidget


# Default layout item shape for React Grid Layout
DEFAULT_LAYOUT: list[dict[str, Any]] = [
    {"i": "signals", "x": 0, "y": 0, "w": 6, "h": 3},
    {"i": "opportunities", "x": 6, "y": 0, "w": 6, "h": 3},
    {"i": "market-overview", "x": 0, "y": 3, "w": 4, "h": 2},
    {"i": "trending-coins", "x": 4, "y": 3, "w": 4, "h": 2},
    {"i": "whale", "x": 8, "y": 3, "w": 4, "h": 2},
]

LAYOUT_TEMPLATES: dict[str, list[dict[str, Any]]] = {
    "trader": [
        {"i": "signals", "x": 0, "y": 0, "w": 6, "h": 3},
        {"i": "opportunities", "x": 6, "y": 0, "w": 6, "h": 3},
        {"i": "market-overview", "x": 0, "y": 3, "w": 6, "h": 2},
        {"i": "trending-coins", "x": 6, "y": 3, "w": 6, "h": 2},
        {"i": "whale", "x": 0, "y": 5, "w": 12, "h": 3},
    ],
    "research": [
        {"i": "opportunities", "x": 0, "y": 0, "w": 8, "h": 4},
        {"i": "signals", "x": 8, "y": 0, "w": 4, "h": 4},
        {"i": "market-overview", "x": 0, "y": 4, "w": 4, "h": 2},
        {"i": "trending-coins", "x": 4, "y": 4, "w": 4, "h": 2},
        {"i": "whale", "x": 8, "y": 4, "w": 4, "h": 2},
    ],
    "airdrop_hunter": [
        {"i": "airdrop", "x": 0, "y": 0, "w": 8, "h": 4},
        {"i": "opportunities", "x": 8, "y": 0, "w": 4, "h": 4},
        {"i": "signals", "x": 0, "y": 4, "w": 6, "h": 2},
        {"i": "wallet-activity", "x": 6, "y": 4, "w": 6, "h": 2},
    ],
    "whale_watcher": [
        {"i": "whale", "x": 0, "y": 0, "w": 8, "h": 4},
        {"i": "wallet-activity", "x": 8, "y": 0, "w": 4, "h": 4},
        {"i": "signals", "x": 0, "y": 4, "w": 6, "h": 2},
        {"i": "market-overview", "x": 6, "y": 4, "w": 6, "h": 2},
    ],
}


def load_user_layout(db: Session, user_id: int) -> dict[str, Any]:
    """
    Load dashboard layout for a user. Returns stored layout_json or default.
    """
    row = (
        db.query(UserDashboardLayout)
        .filter(UserDashboardLayout.user_id == user_id)
        .first()
    )
    if row and row.layout_json and isinstance(row.layout_json, dict):
        layout = row.layout_json.get("layout")
        if isinstance(layout, list) and layout:
            return {"layout": layout}
    return {"layout": list(DEFAULT_LAYOUT)}


def save_user_layout(
    db: Session,
    user_id: int,
    layout_json: dict[str, Any],
) -> None:
    """
    Save dashboard layout for a user. layout_json should have a "layout" key
    with a list of React Grid Layout items.
    """
    layout_list = layout_json.get("layout") if isinstance(layout_json, dict) else None
    if not isinstance(layout_list, list):
        layout_list = list(DEFAULT_LAYOUT)

    row = (
        db.query(UserDashboardLayout)
        .filter(UserDashboardLayout.user_id == user_id)
        .first()
    )
    if row:
        row.layout_json = {"layout": layout_list}
        db.add(row)
    else:
        row = UserDashboardLayout(
            user_id=user_id,
            layout_json={"layout": layout_list},
        )
        db.add(row)
    db.commit()


def reset_layout(
    db: Session,
    user_id: int,
    template: str | None = None,
) -> dict[str, Any]:
    """
    Reset user layout to default or to a named template. Returns the new layout.
    """
    if template and template in LAYOUT_TEMPLATES:
        layout_list = list(LAYOUT_TEMPLATES[template])
    else:
        layout_list = list(DEFAULT_LAYOUT)

    save_user_layout(db, user_id, {"layout": layout_list})
    return {"layout": layout_list}


class LayoutEngine:
    """Convenience wrapper for layout operations."""

    load_user_layout = staticmethod(load_user_layout)
    save_user_layout = staticmethod(save_user_layout)
    reset_layout = staticmethod(reset_layout)


layout_engine = LayoutEngine()
