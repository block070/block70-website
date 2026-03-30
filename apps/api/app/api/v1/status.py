"""Service status API: scheduler jobs, manual triggers, health."""

from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.jobs.scheduler import get_scheduler, try_restart_scheduler_if_stopped
from app.jobs.status_store import get_all_status, JOB_LABELS
from app.models import Signal
from app.services.scrapers.news_scraper import run_news_scraper


router = APIRouter(prefix="/api/v1/status", tags=["status"])

# Some production nginx configs proxy `/api/status` to the API (not Next.js). Mirror v1 routes here.
status_public_router = APIRouter(prefix="/api/status", tags=["status-public"])


@router.get("")
def get_status() -> dict:
    """
    Real-time status of background services (scheduler jobs).
    Returns: scheduler running, jobs with next_run, last_run, status.
    Attempts to restart the scheduler if it stopped unexpectedly.
    """
    try_restart_scheduler_if_stopped()
    scheduler = get_scheduler()
    job_status = get_all_status()

    jobs = []
    if scheduler:
        for job in scheduler.get_jobs():
            jid = job.id
            label = JOB_LABELS.get(jid, jid)
            info = job_status.get(jid, {})
            jobs.append({
                "id": jid,
                "label": label,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "last_run_at": info.get("last_run_at"),
                "last_status": info.get("last_status"),
                "last_error": info.get("last_error"),
            })

    return {
        "scheduler_running": scheduler.running if scheduler else False,
        "jobs": jobs,
    }


def _platform_status_payload(db: Session) -> dict:
    """
    Public-facing component health for the status page: API/DB, signals pipeline, AI config.
    Does not expose secrets. Safe to poll from the marketing site.
    """
    checked_at = datetime.now(timezone.utc).isoformat()

    api_status = "operational"
    api_detail: str | None = None
    api_latency_ms: int | None = None
    try:
        t0 = time.perf_counter()
        db.execute(text("SELECT 1"))
        api_latency_ms = int((time.perf_counter() - t0) * 1000)
    except Exception as exc:  # noqa: BLE001
        api_status = "outage"
        api_detail = str(exc)[:240]

    signals_status = "operational"
    signals_detail: str | None = None
    if api_status == "outage":
        signals_status = "outage"
        signals_detail = "Unavailable while database is unhealthy."
    else:
        try:
            since = datetime.now(timezone.utc) - timedelta(hours=24)
            recent = (
                db.query(Signal)
                .filter(Signal.created_at.isnot(None), Signal.created_at >= since)
                .count()
            )
            if recent == 0:
                signals_status = "degraded"
                signals_detail = "No new signals ingested in the last 24 hours."
        except Exception as exc:  # noqa: BLE001
            signals_status = "outage"
            signals_detail = str(exc)[:240]

    ai_status = "operational"
    ai_detail: str | None = None
    if api_status == "outage":
        ai_status = "outage"
        ai_detail = "Unavailable while database is unhealthy."
    elif not os.getenv("OPENAI_API_KEY"):
        ai_status = "degraded"
        ai_detail = "AI provider key is not configured; AI search and insights may be limited."

    overall = "operational"
    if "outage" in (api_status, signals_status, ai_status):
        overall = "outage"
    elif "degraded" in (api_status, signals_status, ai_status):
        overall = "degraded"

    return {
        "checked_at": checked_at,
        "overall": overall,
        "components": {
            "api": {
                "name": "API & database",
                "status": api_status,
                "detail": api_detail,
                "latency_ms": api_latency_ms,
            },
            "signals": {
                "name": "Signals pipeline",
                "status": signals_status,
                "detail": signals_detail,
            },
            "ai": {
                "name": "AI services",
                "status": ai_status,
                "detail": ai_detail,
            },
        },
    }


@router.get("/platform")
def get_platform_status(db: Session = Depends(get_db)) -> dict:
    return _platform_status_payload(db)


@status_public_router.get("/platform")
def get_platform_status_public_path(db: Session = Depends(get_db)) -> dict:
    """Alias for /api/v1/status/platform when `/api/status` is routed to this API."""
    return _platform_status_payload(db)


@status_public_router.get("")
def get_status_public_path() -> dict:
    """Alias for /api/v1/status when `/api/status` is routed to this API."""
    return get_status()


@router.post("/news/trigger")
def trigger_news_scraper(db: Session = Depends(get_db)) -> dict:
    """
    Manually kick off the news scraper to fill the site with news.
    Fetches from all configured RSS feeds and ingests into the database.
    """
    try:
        run_news_scraper(db)
        return {"status": "ok", "message": "News ingestion completed."}
    except Exception as e:
        return {"status": "error", "message": str(e)}
