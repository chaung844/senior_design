from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
from .enums import UserRole

# Base model for user data
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole = UserRole.viewer

# Model for creating a new user 
class UserCreate(UserBase):
    password: str 

# Model for user login
class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Model for reading user data 
class UserRead(UserBase):
    user_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True) 

# Model for token response
class Token(BaseModel):
    access_token: str
    token_type: str