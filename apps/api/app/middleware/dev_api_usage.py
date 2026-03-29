"""Log /api/v1/dev requests with HTTP status for analytics (after response)."""

from __future__ import annotations

from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.db import SessionLocal
from app.models import ApiKey
from app.services.api.rate_limit_engine import record_usage


class DevApiUsageLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        key_id = getattr(request.state, "api_usage_key_id", None)
        if key_id is None:
            return response
        path = request.url.path
        if not path.startswith("/api/v1/dev"):
            return response
        db = SessionLocal()
        try:
            record_usage(
                db,
                key_id,
                path,
                status_code=response.status_code,
            )
            ak = db.get(ApiKey, key_id)
            if ak:
                ak.last_used = datetime.now(timezone.utc)
                db.add(ak)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
        return response
