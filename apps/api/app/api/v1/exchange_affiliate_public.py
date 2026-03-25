"""
Public read-only affiliate URL templates for exchange CTAs (no auth).

Admin sets rows in `exchange_affiliate_links`; active rows with a non-empty
url_template override built-in deep links on the website.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ExchangeAffiliateLink

router = APIRouter(prefix="/api/v1", tags=["exchange_affiliates"])


@router.get("/exchange-affiliate-links")
def get_public_exchange_affiliate_templates(db: Session = Depends(get_db)) -> dict[str, Any]:
    rows = (
        db.query(ExchangeAffiliateLink)
        .filter(
            ExchangeAffiliateLink.is_active == True,  # noqa: E712
            ExchangeAffiliateLink.url_template.isnot(None),
        )
        .all()
    )
    templates: dict[str, str] = {}
    for r in rows:
        t = (r.url_template or "").strip()
        if t:
            templates[r.provider_key] = t
    return {"templates": templates}
