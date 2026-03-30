from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import User
from app.schemas.user import (
    ForgotPasswordRequest,
    LeadRegisterRequest,
    LoginRequest,
    ResetPasswordRequest,
    UserCreate,
    UserRead,
)
from app.services.auth import (
    authenticate_user,
    complete_password_reset,
    create_user,
    generate_access_token,
    get_user_by_email_ci,
    normalize_email,
    request_password_reset,
)


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    try:
        user = create_user(
            db,
            email=payload.email,
            password=payload.password,
            name=payload.name,
            role=payload.role,
            plan_type=payload.plan_type,
            referrer_code=payload.ref_code,
            referrer_source=payload.ref_source,
            accept_terms=payload.accept_terms,
            accept_privacy=payload.accept_privacy,
            accept_disclaimer=payload.accept_disclaimer,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    return user


@router.post("/register-lead")
def register_lead(
    payload: LeadRegisterRequest,
    db: Session = Depends(get_db),
) -> dict:
    """
    Email-only onboarding: create a free account with a random password, return JWT,
    and email a password-set link (same as forgot-password flow).
    If the email already exists, only the password-reset email is sent (no user enum).
    """
    if not (
        payload.accept_terms
        and payload.accept_privacy
        and payload.accept_disclaimer
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept Terms of Service, Privacy Policy, and Risk Disclaimer",
        )
    canon = normalize_email(payload.email)
    existing = get_user_by_email_ci(db, canon)
    if existing:
        request_password_reset(db, email=canon)
        return {"detail": _FORGOT_PW_OK_MSG, "access_token": None, "user": None}

    raw_password = secrets.token_urlsafe(32)
    display_name = (payload.name or (canon.split("@")[0] or "trader")).strip()[:255]
    try:
        user = create_user(
            db,
            email=canon,
            password=raw_password,
            name=display_name or "Trader",
            role="user",
            plan_type="free",
            referrer_code=payload.ref_code,
            referrer_source=payload.ref_source,
            accept_terms=True,
            accept_privacy=True,
            accept_disclaimer=True,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    request_password_reset(db, email=canon)
    access_token = generate_access_token(
        user_id=user.id,
        email=user.email,
        plan_type=user.plan_type,
    )
    return {
        "detail": "Account created. Check your email to set a password.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserRead.model_validate(user).model_dump(),
    }


@router.post("/login")
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> dict:
    user = authenticate_user(db, email=payload.email, password=payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = generate_access_token(
        user_id=user.id,
        email=user.email,
        plan_type=user.plan_type,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserRead.model_validate(user).model_dump(),
    }


_FORGOT_PW_OK_MSG = (
    "If an account exists for this email, password reset instructions have been sent."
)


@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> dict:
    try:
        request_password_reset(db, email=payload.email)
    except (OperationalError, ProgrammingError) as exc:
        logger.exception("forgot-password database error")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Password reset is temporarily unavailable. "
                "The database may need migration (password reset columns on users). "
                "Contact support if this persists."
            ),
        ) from exc
    return {"detail": _FORGOT_PW_OK_MSG}


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> dict:
    try:
        complete_password_reset(db, token=payload.token, new_password=payload.password)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except (OperationalError, ProgrammingError) as exc:
        logger.exception("reset-password database error")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Password reset failed (database error). "
                "Ensure the users table includes password_reset_token_hash and "
                "password_reset_expires_at."
            ),
        ) from exc
    return {"detail": "Password updated. You can sign in with your new password."}


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/upgrade-me", response_model=UserRead)
def upgrade_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    # Temporary self-upgrade endpoint for premium feature testing.
    current_user.plan = "pro"
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user

