from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from pydantic import BaseModel, ConfigDict


class AlertCreate(BaseModel):
  user_identifier: str
  name: str
  type: str
  conditions_json: Dict[str, Any]


class AlertRead(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: int
  user_identifier: str
  name: str
  type: str
  conditions_json: Dict[str, Any]
  is_active: bool
  created_at: datetime

