"""Service status API: scheduler jobs, manual triggers, health."""

from __future__ import annotations

from datetime import timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.jobs.scheduler import get_scheduler, try_restart_scheduler_if_stopped
from app.jobs.status_store import get_all_status, JOB_LABELS
from app.services.scrapers.news_scraper import run_news_scraper


router = APIRouter(prefix="/api/v1/status", tags=["status"])


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
