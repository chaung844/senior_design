from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.enums import DocumentStatus, DocumentType, JobStatus, JobType


class JobCreate(BaseModel):
    name: str
    status: JobStatus = JobStatus.pending


class JobRead(BaseModel):
    job_id: int
    name: str
    status: JobStatus
    created_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JobListResponse(BaseModel):
    jobs: list[JobRead]
    total: int
    offset: int
    limit: int


class JobStatusDocument(BaseModel):
    """Minimal document info for job status polling."""

    document_id: int
    file_name: str
    document_type: DocumentType
    status: DocumentStatus

    model_config = ConfigDict(from_attributes=True)


class JobStatusResponse(BaseModel):
    """Response for GET /jobs/{job_id}/status per Tier 2 spec."""

    job_id: int
    status: JobStatus
    job_type: JobType
    documents: list[JobStatusDocument]
