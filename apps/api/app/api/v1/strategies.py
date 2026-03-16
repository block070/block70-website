from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import UserStrategy
from app.services.auth.plan_access import require_pro
from app.services.rate_limit.rate_limiter import rate_limit_dependency


router = APIRouter(prefix="/api/v1/strategies", tags=["strategies"])


class UserStrategyCreate(BaseModel):
  user_identifier: str = Field(
      ...,
      description="User identifier (e.g. email, wallet address, or account ID).",
  )
  strategy_name: str = Field(
      ...,
      description="Human-readable name for this strategy.",
  )
  conditions: Dict[str, Any] = Field(
      default_factory=dict,
      description="Arbitrary JSON conditions describing the strategy logic.",
  )


def _serialize_strategy(strategy: UserStrategy) -> Dict[str, Any]:
  return {
      "id": strategy.id,
      "user_identifier": strategy.user_identifier,
      "strategy_name": strategy.strategy_name,
      "conditions": strategy.conditions_json or {},
      "created_at": strategy.created_at.isoformat(),
      "updated_at": strategy.updated_at.isoformat(),
  }


@router.get(
  "",
  dependencies=[Depends(rate_limit_dependency), Depends(require_pro)],
)
def list_strategies(
  db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
  """
  List all user strategies.
  """
  strategies: List[UserStrategy] = (
      db.query(UserStrategy)
      .order_by(UserStrategy.created_at.asc())
      .all()
  )
  return [_serialize_strategy(s) for s in strategies]


@router.post(
  "",
  dependencies=[Depends(rate_limit_dependency), Depends(require_pro)],
)
def create_strategy(
  payload: UserStrategyCreate,
  db: Session = Depends(get_db),
) -> Dict[str, Any]:
  """
  Create a new user strategy.
  """
  strategy = UserStrategy(
      user_identifier=payload.user_identifier,
      strategy_name=payload.strategy_name,
      conditions_json=payload.conditions,
  )
  db.add(strategy)
  db.commit()
  db.refresh(strategy)
  return _serialize_strategy(strategy)


@router.delete("/{strategy_id}")
def delete_strategy(
  strategy_id: int = Path(..., description="ID of the strategy to delete."),
  db: Session = Depends(get_db),
) -> Dict[str, Any]:
  """
  Delete a user strategy by ID.
  """
  strategy: UserStrategy | None = (
      db.query(UserStrategy)
      .filter(UserStrategy.id == strategy_id)
      .first()
  )
  if strategy is None:
      raise HTTPException(status_code=404, detail="Strategy not found")

  db.delete(strategy)
  db.commit()
  return {"status": "deleted", "id": strategy_id}

