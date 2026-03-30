"""
Plan hierarchy, feature matrix, and effective subscription tier resolution.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models import Subscription, User

from app.models.user import UserRole

# free < pro < elite < quant; admin treated as maximum access
PLAN_ORDER: dict[str, int] = {
    "free": 0,
    "pro": 1,
    "elite": 2,
    "quant": 3,
}

# feature key -> plans that may use the capability
FEATURE_MATRIX: dict[str, frozenset[str]] = {
    "opportunities_full": frozenset({"elite", "quant"}),
    "signals_medium": frozenset({"pro", "elite", "quant"}),
    "signals_high": frozenset({"elite", "quant"}),
    "ai_full": frozenset({"pro", "elite", "quant"}),
    "api_access": frozenset({"quant"}),
}

_ACTIVE_SUB_STATUSES = frozenset(
    {"active", "trialing", "past_due"},
)


def normalize_plan(plan: str | None) -> str:
    p = (plan or "free").lower().strip()
    if p == "admin":
        return "admin"
    if p in PLAN_ORDER:
        return p
    return "free"


def plan_rank(plan: str) -> int:
    p = normalize_plan(plan)
    if p == "admin":
        return 10_000
    return PLAN_ORDER.get(p, 0)


def has_access(effective_plan: str, required_plan: str) -> bool:
    if normalize_plan(effective_plan) == "admin":
        return True
    return plan_rank(effective_plan) >= plan_rank(required_plan)


def has_feature(effective_plan: str, feature: str) -> bool:
    allowed = FEATURE_MATRIX.get(feature)
    if allowed is None:
        return False
    eff = normalize_plan(effective_plan)
    if eff == "admin":
        return True
    return eff in allowed


def effective_plan(user: User, subscription: Subscription | None) -> str:
    """Authoritative tier for gating: subscription when active, else user.plan_type."""
    if getattr(user, "role", None) == UserRole.ADMIN.value:
        return "admin"
    if subscription is not None:
        st = (subscription.status or "").lower()
        if st in _ACTIVE_SUB_STATUSES and subscription.plan_type:
            return normalize_plan(subscription.plan_type)
    return normalize_plan(getattr(user, "plan_type", None))
