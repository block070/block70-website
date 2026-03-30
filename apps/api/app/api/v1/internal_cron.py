from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.notifications.notification_jobs import run_all_notification_cron_jobs

router = APIRouter(prefix="/api/v1/internal/cron", tags=["internal-cron"])


@router.post("/notifications")
def run_notification_cron(
    db: Session = Depends(get_db),
    x_cron_secret: str | None = Header(None, alias="X-Cron-Secret"),
) -> dict:
    expected = (os.getenv("CRON_SECRET") or "").strip()
    if not expected or (x_cron_secret or "").strip() != expected:
        raise HTTPException(status_code=403, detail="Invalid or missing cron secret")
    result = run_all_notification_cron_jobs(db)
    return {"ok": True, "counts": result}
