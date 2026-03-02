import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.enums import DocumentStatus, DocumentType

# Allowed MIME types for document uploads.
_ALLOWED_MIME_TYPES: set[str] = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

_MAX_FILENAME_LENGTH = 255


class DocumentUploadRequest(BaseModel):
    file_name: str
    file_type: str
    document_type: DocumentType
    account_id: Optional[int] = None

    @field_validator("file_name")
    @classmethod
    def validate_file_name(cls, v: str) -> str:
        v = v.strip()

        # Replace invalid characters with underscore
        v = re.sub(r"[^\w\-. ]", "_", v)

        # Prevent directory traversal
        while ".." in v:
            v = v.replace("..", ".")

        # Prevent hidden files
        v = v.lstrip(".")

        v = v.strip()

        if not v:
            raise ValueError("file_name must not be empty after sanitization")
        if len(v) > _MAX_FILENAME_LENGTH:
            raise ValueError(
                f"file_name must be at most {_MAX_FILENAME_LENGTH} characters"
            )

        # Normalize file extension to lowercase (.PDF -> .pdf, .JPG -> .jpg, etc.)
        if "." in v:
            name, _, ext = v.rpartition(".")
            v = f"{name}.{ext.lower()}"

        return v

    @field_validator("file_type")
    @classmethod
    def validate_file_type(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in _ALLOWED_MIME_TYPES:
            raise ValueError(
                f"file_type must be one of: {', '.join(sorted(_ALLOWED_MIME_TYPES))}"
            )
        return v


class DocumentUploadResponse(BaseModel):
    upload_url: str
    document_id: int
    s3_key: str


class DocumentConfirmResponse(BaseModel):
    document_id: int
    status: DocumentStatus = DocumentStatus.pending_processing
    job_id: Optional[int] = None

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
