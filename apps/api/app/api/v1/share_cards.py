from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from starlette.responses import FileResponse

from app.db import get_db
from app.models import Opportunity
from app.services.opportunity_card_generator import generate_opportunity_share_card


router = APIRouter(prefix="/api/v1", tags=["share-cards"])


@router.get("/opportunities/{opportunity_id}/share-card")
def get_opportunity_share_card(
    opportunity_id: int,
    db: Session = Depends(get_db),
) -> FileResponse:
    """
    Generate (or regenerate) a shareable PNG card for the given opportunity ID
    and return it as an image response.
    """
    opportunity = db.query(Opportunity).filter(Opportunity.id == opportunity_id).first()
    if opportunity is None:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    try:
        path = generate_opportunity_share_card(opportunity)
    except RuntimeError as exc:
        # Surface a clear error if Pillow or fonts are not available.
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return FileResponse(
        path,
        media_type="image/png",
        filename=path.split("/")[-1],
    )

