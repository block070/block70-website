from __future__ import annotations

import hashlib
import json
import logging
import os
import secrets
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import bcrypt
import jwt
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import User
from app.services.alerts.notifications import send_smtp_email

logger = logging.getLogger(__name__)


def _resolve_agent_debug_log() -> Path:
    """Monorepo: block70/apps/api/... → log under repo root. Docker (WORKDIR /app): use system temp."""
    here = Path(__file__).resolve()
    for anc in here.parents:
        try:
            if (anc / "apps" / "api").is_dir():
                return anc / "debug-9aa1f6.log"
        except OSError:
            continue
    return Path(tempfile.gettempdir()) / "debug-9aa1f6.log"


_DEBUG_LOG = _resolve_agent_debug_log()


def _agent_dbg(location: str, message: str, data: dict) -> None:
    payload = {
        "sessionId": "9aa1f6",
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000),
    }
    try:
        with open(_DEBUG_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload) + "\n")
    except Exception:
        pass


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def get_user_by_email_ci(db: Session, email: str) -> Optional[User]:
    norm = normalize_email(email)
    if not norm:
        return None
    return db.query(User).filter(func.lower(User.email) == norm).first()


def hash_password(plain_password: str) -> str:
    password_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def create_user(
    db: Session,
    *,
    email: str,
    password: str,
    name: str,
    role: str = "user",
    plan_type: str = "free",
    referrer_code: str | None = None,
    referrer_source: str | None = None,
    accept_terms: bool = False,
    accept_privacy: bool = False,
    accept_disclaimer: bool = False,
) -> User:
    if not (accept_terms and accept_privacy and accept_disclaimer):
        raise ValueError("You must accept Terms of Service, Privacy Policy, and Risk Disclaimer to register")
    canon = normalize_email(email)
    existing = get_user_by_email_ci(db, canon)
    if existing:
        raise ValueError("User with this email already exists")

    user = User(
        email=canon,
        password_hash=hash_password(password),
        name=name,
        role=role,
        plan_type=plan_type,
        is_active=True,
    )
    db.add(user)
    db.flush()

    from app.models import TermsAcceptance

    now = datetime.now(timezone.utc)
    db.add(
        TermsAcceptance(
            user_id=user.id,
            terms_accepted_at=now,
            privacy_accepted_at=now,
            disclaimer_accepted_at=now,
        )
    )

    if referrer_code:
        from app.services.referral_service import resolve_referrer_by_code, create_referral_record
        referrer = resolve_referrer_by_code(db, referrer_code)
        if referrer and referrer.id != user.id:
            create_referral_record(
                db,
                referrer_user_id=referrer.id,
                referred_user_id=user.id,
                referral_source=referrer_source,
            )
            from app.services.rewards.reward_engine import award_blocks
            award_blocks(db, referrer.id, "referral_signup", description="Referral signup")

    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, email: str, password: str) -> Optional[User]:
    # #region agent log
    _agent_dbg(
        "auth.authenticate_user",
        "entry",
        {"hypothesisId": "H1", "email_len": len((email or "").strip())},
    )
    # #endregion
    user = get_user_by_email_ci(db, email)
    # #region agent log
    _agent_dbg(
        "auth.authenticate_user",
        "after_lookup",
        {"hypothesisId": "H1", "user_found": user is not None},
    )
    # #endregion
    if not user:
        return None
    # #region agent log
    _agent_dbg(
        "auth.authenticate_user",
        "active_check",
        {"hypothesisId": "H3", "is_active": bool(user.is_active)},
    )
    # #endregion
    if not user.is_active:
        return None
    pw_ok = verify_password(password, user.password_hash)
    # #region agent log
    _agent_dbg(
        "auth.authenticate_user",
        "password_verify",
        {"hypothesisId": "H2", "password_ok": pw_ok},
    )
    # #endregion
    if not pw_ok:
        return None
    return user


def request_password_reset(db: Session, *, email: str) -> None:
    user = get_user_by_email_ci(db, email)
    if not user:
        return
    raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    base = (os.getenv("BLOCK70_PUBLIC_URL") or "").strip().rstrip("/")
    if not base:
        fe = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
        base = fe.split(",")[0].strip().rstrip("/")
    link = f"{base}/reset-password?token={raw}"
    ok, err = send_smtp_email(
        to_addr=user.email,
        subject="Reset your Block70 password",
        body=(
            "Use this link to set a new password (expires in 1 hour):\n\n"
            f"{link}\n\n"
            "If you did not request this, ignore this email."
        ),
    )
    if not ok:
        logger.warning("password reset email not sent user_id=%s: %s", user.id, err)
        return
    user.password_reset_token_hash = token_hash
    user.password_reset_expires_at = expires
    db.add(user)
    db.commit()


def complete_password_reset(db: Session, *, token: str, new_password: str) -> None:
    if len(new_password) < 8:
        raise ValueError("Password must be at least 8 characters")
    th = hashlib.sha256(token.strip().encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)
    user = db.query(User).filter(User.password_reset_token_hash == th).first()
    if (
        not user
        or user.password_reset_expires_at is None
        or user.password_reset_expires_at < now
    ):
        raise ValueError("Invalid or expired reset link")
    user.password_hash = hash_password(new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    db.add(user)
    db.commit()


def _get_jwt_secret() -> str:
    # In production, read from environment or secrets manager.
    # FastAPI app can override via settings if needed.
    import os

    return os.getenv("JWT_SECRET_KEY", "change-me-in-production")


def generate_access_token(
    *,
    user_id: int,
    email: str,
    expires_in_hours: int = 24,
) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(hours=expires_in_hours)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": exp,
        "iat": now,
        "type": "access",
    }
    secret = _get_jwt_secret()
    token = jwt.encode(payload, secret, algorithm="HS256")
    # pyjwt>=2 returns str, older versions may return bytes
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


def verify_access_token(token: str) -> Optional[dict]:
    secret = _get_jwt_secret()
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        if payload.get("type") != "access":
            return None
        return payload
    except jwt.PyJWTError:
        return None
