from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.enums import JobStatus


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
