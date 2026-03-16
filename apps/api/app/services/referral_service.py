"""
Referral code generation and link building.
"""

from __future__ import annotations

import secrets
import string
from sqlalchemy.orm import Session

from app.models import User, Referral

REFERRAL_CODE_LENGTH = 8
SIGNUP_BASE_URL = "https://block70.com/signup"


def _generate_code() -> str:
    """Generate a URL-safe referral code (alphanumeric)."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(REFERRAL_CODE_LENGTH))


def ensure_user_referral_code(db: Session, user: User) -> str:
    """
    Ensure user has a unique referral_code; generate and assign if missing.
    Returns the referral code.
    """
    if user.referral_code:
        return user.referral_code
    for _ in range(20):
        code = _generate_code()
        exists = db.query(User).filter(User.referral_code == code).first()
        if not exists:
            user.referral_code = code
            db.add(user)
            db.flush()
            return code
    # Fallback: use id-based code
    code = f"B70{user.id}"
    user.referral_code = code
    db.add(user)
    db.flush()
    return code


def get_referral_link(db: Session, user: User, base_url: str | None = None) -> str:
    """Get the full referral signup link for the user."""
    base = (base_url or SIGNUP_BASE_URL).rstrip("/")
    code = ensure_user_referral_code(db, user)
    return f"{base}?ref={code}"


def resolve_referrer_by_code(db: Session, code: str) -> User | None:
    """Return the User who owns this referral code, or None."""
    return db.query(User).filter(User.referral_code == code).first()


def create_referral_record(
    db: Session,
    referrer_user_id: int,
    referred_user_id: int,
    referral_source: str | None = None,
) -> Referral:
    """Record that referred_user_id was referred by referrer_user_id. referral_source e.g. 'bot', 'link'."""
    r = Referral(
        referrer_user_id=referrer_user_id,
        referred_user_id=referred_user_id,
        reward_status="pending",
        referral_source=referral_source,
    )
    db.add(r)
    db.flush()
    return r
