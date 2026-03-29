"""API key scopes, IP allowlists, and route permission checks."""

from __future__ import annotations

import ipaddress
from typing import Any

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.models import ApiKey


DEFAULT_SCOPES: dict[str, bool] = {
    "read": True,
    "write": False,
    "trading": False,
}


def client_ip_from_request(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    if request.client:
        return request.client.host or ""
    return ""


def ip_allowed(client_ip: str, allowlist: list[Any] | None) -> bool:
    if not allowlist or len(allowlist) == 0:
        return True
    if not client_ip:
        return False
    try:
        client_addr = ipaddress.ip_address(client_ip)
    except ValueError:
        return False
    for raw in allowlist:
        entry = str(raw).strip()
        if not entry:
            continue
        try:
            if "/" in entry:
                net = ipaddress.ip_network(entry, strict=False)
                if client_addr in net:
                    return True
            else:
                if client_addr == ipaddress.ip_address(entry):
                    return True
        except ValueError:
            continue
    return False


def effective_scopes(api_key: ApiKey) -> dict[str, bool]:
    """
    Legacy keys (scopes NULL): full access so existing integrations keep working.
    New keys store explicit scopes in JSONB.
    """
    raw = api_key.scopes
    if raw is None:
        return {"read": True, "write": True, "trading": True}
    if not isinstance(raw, dict):
        return {"read": True, "write": True, "trading": True}
    out = {**DEFAULT_SCOPES}
    for k in ("read", "write", "trading"):
        if k in raw:
            out[k] = bool(raw[k])
    return out


def path_requires_trading(path: str) -> bool:
    return path.startswith("/api/v1/dev/portfolio") or path.startswith(
        "/api/v1/dev/strategies"
    )


def path_requires_write(method: str) -> bool:
    return method.upper() in ("POST", "PUT", "PATCH", "DELETE")


def enforce_api_key_access(request: Request, api_key: ApiKey, db: Session) -> None:
    """Raise HTTPException if scopes or IP disallow this request."""
    _ = db  # reserved for audit hooks
    method = request.method
    path = request.url.path
    eff = effective_scopes(api_key)

    if not eff.get("read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This API key does not have read permission",
        )
    if path_requires_write(method) and not eff.get("write"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This API key does not have write permission",
        )
    if path_requires_trading(path) and not eff.get("trading"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This API key does not have trading permission (required for portfolio/strategy endpoints)",
        )

    alist = api_key.ip_allowlist
    if isinstance(alist, list) and len(alist) > 0:
        cip = client_ip_from_request(request)
        if not ip_allowed(cip, alist):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Request IP is not in this key's allowed list",
            )
