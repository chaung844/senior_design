from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr

from app.enums import UserRole


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole = UserRole.viewer


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    new_password: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(UserBase):
    user_id: int
    is_active: bool
    created_by_user_id: int | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class UserListResponse(BaseModel):
    users: list[UserRead]
    total: int
    offset: int
    limit: int
