from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from sqlalchemy.orm import Session

from app.models import User


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
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError("User with this email already exists")

    user = User(
        email=email,
        password_hash=hash_password(password),
        name=name,
        role=role,
        plan_type=plan_type,
        is_active=True,
    )
    db.add(user)
    db.flush()

    from datetime import datetime, timezone
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
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


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
