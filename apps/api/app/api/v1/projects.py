from __future__ import annotations

from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import CandidateProject


router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


def _serialize_candidate(project: CandidateProject) -> Dict:
    return {
        "id": project.id,
        "project_name": project.project_name,
        "token_symbol": project.token_symbol,
        "chain": project.chain,
        "source": project.source,
        "source_url": project.source_url,
        "description": project.description,
        "dev_activity_score": project.dev_activity_score,
        "social_activity_score": project.social_activity_score,
        "confidence_score": project.confidence_score,
        "detected_at": project.detected_at.isoformat()
        if project.detected_at is not None
        else None,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
    }


@router.get("")
def list_candidate_projects(
    db: Session = Depends(get_db),
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
        description="Maximum number of candidate projects to return.",
    ),
) -> List[Dict]:
    """
    Return recently detected candidate projects ordered by creation time.
    """
    projects = (
        db.query(CandidateProject)
        .order_by(CandidateProject.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_candidate(p) for p in projects]


@router.get("/{project_id}")
def get_candidate_project(
    project_id: int = Path(..., description="ID of the candidate project"),
    db: Session = Depends(get_db),
) -> Dict:
    """
    Return a single candidate project by ID.
    """
    project = (
        db.query(CandidateProject)
        .filter(CandidateProject.id == project_id)
        .first()
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Candidate project not found")

    return _serialize_candidate(project)

