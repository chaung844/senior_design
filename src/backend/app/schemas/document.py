from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.enums import DocumentStatus, DocumentType


class DocumentUploadRequest(BaseModel):
    file_name: str
    file_type: str
    document_type: DocumentType
    account_id: Optional[int] = None


class DocumentUploadResponse(BaseModel):
    upload_url: str
    document_id: int
    s3_key: str


class DocumentConfirmResponse(BaseModel):
    document_id: int
    status: DocumentStatus = DocumentStatus.pending_processing

    model_config = ConfigDict(from_attributes=True)


class DocumentRead(BaseModel):
    document_id: int
    file_name: str
    document_type: DocumentType
    s3_key: str
    status: DocumentStatus
    error_message: Optional[str] = None
    account_id: Optional[int] = None
    receipt_id: Optional[int] = None
    statement_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentListResponse(BaseModel):
    documents: list[DocumentRead]
    total: int
    offset: int
    limit: int


class FileUrlResponse(BaseModel):
    url: str
    expires_in: int
