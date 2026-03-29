"""Versioned execution / risk block merged into TradingStrategy.conditions_json under key \"execution\"."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class StrategyExecutionV1(BaseModel):
    """v1: TP/SL, hold window, sizing, simulation caps (signal-based backtests)."""

    take_profit_pct: float = Field(default=10.0, ge=0.1, le=500.0)
    stop_loss_pct: float = Field(default=5.0, ge=0.1, le=100.0)
    max_hold_hours: int = Field(default=24, ge=1, le=168 * 4)
    stake_usd: float = Field(default=1_000.0, ge=1.0, le=1e9)
    starting_capital: float = Field(default=100_000.0, ge=100.0, le=1e12)
    max_entries_per_run: int = Field(default=50, ge=1, le=500)


def parse_execution_from_conditions(conditions: dict[str, Any]) -> StrategyExecutionV1:
    raw = conditions.get("execution")
    if raw is None:
        return StrategyExecutionV1()
    if isinstance(raw, dict):
        try:
            return StrategyExecutionV1.model_validate(raw)
        except Exception:
            return StrategyExecutionV1()
    return StrategyExecutionV1()


def merge_execution_into_conditions(
    conditions: dict[str, Any],
    execution: StrategyExecutionV1,
) -> dict[str, Any]:
    out = {**conditions, "execution": execution.model_dump()}
    return out
