from __future__ import annotations

from datetime import datetime
from typing import Any, List

from pydantic import BaseModel, ConfigDict


class LayoutItem(BaseModel):
    i: str
    x: int
    y: int
    w: int
    h: int


class DashboardLayoutRead(BaseModel):
    layout: List[dict[str, Any]]


class DashboardLayoutUpdate(BaseModel):
    layout: List[dict[str, Any]]


class DashboardWidgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    widget_name: str
    widget_type: str
    description: str | None
    default_position: dict[str, Any] | None
    created_at: datetime
