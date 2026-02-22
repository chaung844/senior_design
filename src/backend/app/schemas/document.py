from pydantic import BaseModel, ConfigDict
from app.enums import DocumentType, DocumentStatus


class DocumentUploadRequest(BaseModel):
    file_name: str
    file_type: str
    document_type: DocumentType


class DocumentUploadResponse(BaseModel):
    upload_url: str
    document_id: int
    s3_key: str


class DocumentConfirmResponse(BaseModel):
    document_id: int
    status: DocumentStatus = DocumentStatus.pending_processing

    model_config = ConfigDict(from_attributes=True)
