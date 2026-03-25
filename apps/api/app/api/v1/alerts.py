from typing import List

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Alert
from app.services.auth.plan_access import require_pro
from app.services.rate_limit.rate_limiter import rate_limit_dependency
from app.schemas.alert import AlertCreate, AlertRead


router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])

# Block70 crypto chart alerts: use type "b70_crypto_v1" and `conditions_json` as documented in
# `app/services/alerts/crypto_alert_runner.py` (coin slugs, timeframe, triggers, delivery).


@router.post(
    "",
    response_model=AlertRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_dependency), Depends(require_pro)],
)
def create_alert(
    payload: AlertCreate,
    db: Session = Depends(get_db),
) -> Alert:
    alert = Alert(
        user_identifier=payload.user_identifier,
        name=payload.name,
        type=payload.type,
        conditions_json=payload.conditions_json,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.get(
    "",
    response_model=List[AlertRead],
    dependencies=[Depends(rate_limit_dependency), Depends(require_pro)],
)
def list_alerts(
    db: Session = Depends(get_db),
) -> List[Alert]:
    return db.query(Alert).order_by(Alert.created_at.desc()).all()


@router.delete(
    "/{alert_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_alert(
    alert_id: int = Path(..., description="ID of the alert"),
    db: Session = Depends(get_db),
) -> None:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    db.delete(alert)
    db.commit()
    return None

