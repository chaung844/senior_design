from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.enums import AccountType


class AccountBookCreate(BaseModel):
    bank_name: str
    account_name: str
    account_type: AccountType = AccountType.credit_card
    currency: str = "USD"
    account_number_last4: str


class AccountBookUpdate(BaseModel):
    bank_name: Optional[str] = None
    account_name: Optional[str] = None
    account_type: Optional[AccountType] = None
    currency: Optional[str] = None
    account_number_last4: Optional[str] = None


class AccountBookRead(BaseModel):
    account_id: int
    bank_name: str
    account_name: str
    account_type: AccountType
    currency: str
    account_number_last4: str
    user_id: int
    created_at: datetime
    updated_at: datetime
    member_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class AccountBookListResponse(BaseModel):
    accounts: list[AccountBookRead]
    total: int
    offset: int
    limit: int


class MemberRead(BaseModel):
    id: int
    account_id: int
    user_id: int
    user_name: str
    user_email: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MemberAdd(BaseModel):
    user_id: int


class MemberListResponse(BaseModel):
    members: list[MemberRead]
    total: int
