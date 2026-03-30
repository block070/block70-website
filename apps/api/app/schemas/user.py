from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr


RoleLiteral = Literal["admin", "user"]
PlanTypeLiteral = Literal["free", "pro", "elite", "quant"]
PlanLiteral = Literal["free", "pro", "elite", "quant", "admin"]


class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: RoleLiteral = "user"
    plan_type: PlanTypeLiteral = "free"
    is_active: bool = True


class UserCreate(UserBase):
    password: str
    ref_code: str | None = None
    ref_source: str | None = None
    accept_terms: bool = False
    accept_privacy: bool = False
    accept_disclaimer: bool = False


class LeadRegisterRequest(BaseModel):
    """Passwordless lead capture: creates account with random password + emails set-password link."""

    email: EmailStr
    name: str | None = None
    accept_terms: bool = False
    accept_privacy: bool = False
    accept_disclaimer: bool = False
    ref_code: str | None = None
    ref_source: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str
    role: RoleLiteral
    plan_type: PlanTypeLiteral
    plan: PlanLiteral
    is_active: bool
    created_at: datetime
    updated_at: datetime
    trial_end: datetime | None = None
    subscription_status: str | None = None

