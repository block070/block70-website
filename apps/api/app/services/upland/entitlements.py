"""Python side of the Upland feature matrix.

SOURCE OF TRUTH: apps/web/lib/upland/feature-matrix.json. Both the TS and
Python sides load from that file so a single edit keeps them in sync. A CI
parity test asserts both halves agree.

The TS file is treated as shared config; we resolve the absolute path at
import time. If the file cannot be loaded, every feature falls back to
returning False -- that degrades to "free tier for everyone", which is the
safe default.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from app.models import User
from app.services.billing.upland_stripe import get_active_upland_tier

UPLAND_TIERS: tuple[str, ...] = ("free", "pro", "elite")


@lru_cache(maxsize=1)
def _load_matrix() -> dict:
    env_path = os.getenv("UPLAND_FEATURE_MATRIX_PATH")
    candidates = []
    if env_path:
        candidates.append(Path(env_path))
    # Default: apps/web/lib/upland/feature-matrix.json relative to repo root.
    repo_root = Path(__file__).resolve().parents[4]
    candidates.append(repo_root / "apps" / "web" / "lib" / "upland" / "feature-matrix.json")
    for path in candidates:
        try:
            with path.open("r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            continue
        except Exception:
            continue
    return {"version": 0, "features": {}, "limits": {"free": {}, "pro": {}, "elite": {}}}


UPLAND_FEATURE_MATRIX = _load_matrix()


def tier_for_user(db: Session, user: User) -> str:
    """Resolve the effective Upland tier for a user.

    Order of precedence:
      1. Admin role     -> "elite"
      2. Global plan    -> admin/quant tiers inherit "elite"
      3. product_entitlements row -> "pro" | "elite" when active
      4. Default        -> "free"
    """
    role = (getattr(user, "role", None) or "").lower()
    if role == "admin":
        return "elite"

    plan = (user.plan_type or "free").lower()
    if plan in ("quant", "admin"):
        return "elite"

    active = get_active_upland_tier(db, user.id)
    return active if active in ("pro", "elite") else "free"


def has_upland_feature(tier: str, feature: str) -> bool:
    allowed: list[str] = (UPLAND_FEATURE_MATRIX.get("features") or {}).get(feature, [])
    return tier in allowed


def resolve_upland_limits(tier: str) -> dict:
    return (UPLAND_FEATURE_MATRIX.get("limits") or {}).get(tier) or {}


def features_for_tier(tier: str) -> list[str]:
    out: list[str] = []
    for feature, tiers in (UPLAND_FEATURE_MATRIX.get("features") or {}).items():
        if tier in tiers:
            out.append(feature)
    return out


def require_upland_feature(
    db: Session, user: User, feature: str
) -> Optional[str]:
    """Return None if allowed; else a short reason suitable for a 402 body."""
    tier = tier_for_user(db, user)
    if has_upland_feature(tier, feature):
        return None
    return f"Feature '{feature}' requires Upland Pro or Elite. Current tier: {tier}."


def feature_matrix_version() -> int:
    return int(UPLAND_FEATURE_MATRIX.get("version") or 0)


def all_upland_features() -> Iterable[str]:
    return (UPLAND_FEATURE_MATRIX.get("features") or {}).keys()
