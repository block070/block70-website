from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr


RoleLiteral = Literal["admin", "user"]
PlanTypeLiteral = Literal["free", "pro", "elite"]
PlanLiteral = Literal["free", "pro", "admin"]


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

